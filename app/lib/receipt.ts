import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

// 日常の入力画面と旅行の入力画面で共通のレシート処理

export type ScanResult = {
  store_name?: string;
  amount?: number;
  date?: string;
  category?: string; // 日常用のカテゴリ (food / daily / eatout / transport / other)
};

// iPhoneのHEICはそのままだとプレビューもAI解析もできないのでJPEGに変換する
export const normalizeImage = async (file: File): Promise<File> => {
  if (!file.name.toLowerCase().endsWith('.heic') && file.type !== 'image/heic') return file;
  const heic2any = (await import('heic2any')).default;
  const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.7 });
  const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
  return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
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
    headers: { 'Content-Type': 'application/json' },
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
  category: string; // 日常用のカテゴリ
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64Data, mimeType: 'image/jpeg', today }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '読み取りに失敗しました');
  return data.items ?? [];
};

export const uploadReceipt = async (file: File) => {
  try {
    const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.6 };
    const compressedFile = await imageCompression(file, options);
    const fileExt = 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;
    const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, compressedFile, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload failed:', error);
    return null;
  }
};

export const removeReceipts = async (urls: (string | null)[]) => {
  const fileNames = urls.map((url) => url?.split('/').pop()).filter((name): name is string => !!name);
  if (fileNames.length > 0) await supabase.storage.from('receipts').remove(fileNames);
};
