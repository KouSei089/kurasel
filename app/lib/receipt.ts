import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

// 日常の入力画面と旅行の入力画面で共通のレシート処理

export type ScanResult = {
  store_name?: string;
  amount?: number;
  date?: string;
  category?: string; // CATEGORIES の id
};

// iPhoneのHEICはそのままだとプレビューもAI解析もできないのでJPEGに変換する
export const normalizeImage = async (file: File): Promise<File> => {
  if (!file.name.toLowerCase().endsWith('.heic') && file.type !== 'image/heic') return file;
  const heic2any = (await import('heic2any')).default;
  const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.7 });
  const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
  return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
};

// AI のAPIは、ログインした人だけが使える（Gemini の無料枠を他人に使われないように）
const authHeaders = async (): Promise<Record<string, string>> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const scanReceipt = async (file: File): Promise<ScanResult> => {
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });

  // Geminiのキーはサーバー側にしか置かないので、APIルート経由で呼ぶ
  const res = await fetch('/api/analyze-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ imageBase64: base64Data, mimeType: file.type }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '読み取りに失敗しました');
  return data;
};

// 決済アプリの利用履歴のスクリーンショットから読み取った1件分
export type HistoryItem = {
  store_name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string; // CATEGORIES の id
  kind: 'payment' | 'transfer'; // お店への支払い / 人への送付
};

// 利用履歴のスクリーンショットから支払いをまとめて読み取る。
// スクショはそのままだと数MBあり、サーバーへの送信上限にかかるので、文字が読める大きさのまま軽くして送る
export const scanHistory = async (file: File, today: string): Promise<HistoryItem[]> => {
  const compressed = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.85 });
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(compressed);
  });

  const res = await fetch('/api/analyze-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ imageBase64: base64Data, mimeType: 'image/jpeg', today }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '読み取りに失敗しました');
  return data.items ?? [];
};

// 画像は「世帯のID/ファイル名」に置く（同じ世帯のメンバーだけが追加・削除できる）。
// 表示は公開URLで行うので、ファイル名は推測できないようにする
export const uploadReceipt = async (file: File, householdId: string) => {
  try {
    const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.6 };
    const compressedFile = await imageCompression(file, options);
    const fileExt = 'jpg';
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${householdId}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, compressedFile, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload failed:', error);
    return null;
  }
};

// 公開URL（…/object/public/receipts/世帯のID/ファイル名）からバケット内のパスを取り出して消す。
// Google ログイン以前の画像はフォルダなしで置かれていて、権限がないので消えない（記録の削除は続ける）
export const removeReceipts = async (urls: (string | null)[]) => {
  const paths = urls.map((url) => url?.split('/receipts/')[1]).filter((path): path is string => !!path);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from('receipts').remove(paths);
  if (error) console.error(error);
};

// 給与明細・賞与明細のスクリーンショットから読み取った内容（/api/analyze-payslip）
export type PayslipDeductionType = 'social_insurance' | 'tax' | 'other';
export type Payslip = {
  kind: 'salary' | 'bonus';
  pay_date: string | null; // YYYY-MM-DD。読めなければ null
  employer: string;
  gross: number; // 総支給額
  net: number; // 差引支給額（手取り）
  deductions: { name: string; amount: number; type: PayslipDeductionType }[];
};

// 明細は細かい数字が多いので、履歴のスクショと同じく文字が読める大きさのまま軽くして送る
export const scanPayslip = async (file: File): Promise<Payslip> => {
  const compressed = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.85 });
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(compressed);
  });

  const res = await fetch('/api/analyze-payslip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ imageBase64: base64Data, mimeType: 'image/jpeg' }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '読み取りに失敗しました');
  return data;
};
