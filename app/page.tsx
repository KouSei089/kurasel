'use client';
import { useState } from 'react';
import { supabase } from './lib/supabase';
import { Check, Loader2, Smartphone, ChevronRight, Users, UserPlus } from 'lucide-react';
import Link from 'next/link';
import Modal from './components/Modal';
import ExcludedToggle from './components/ExcludedToggle';
import ReceiptCapture from './components/ReceiptCapture';
import { PageShell, PageHeader, Card, SectionTitle, Field, CategoryPicker, buttonClass, inputClass } from './components/ui';
import { normalizeImage, scanReceipt, uploadReceipt } from './lib/receipt';
import { normalizeCategory } from './lib/categories';
import { useCurrentUser } from './lib/useCurrentUser';
import { todayYMD } from './lib/date';

export default function Home() {
  const { isDemoMode, myUserId, myUserName, householdId, partner } = useCurrentUser();

  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayYMD);
  const [category, setCategory] = useState('food');
  const [isExcluded, setIsExcluded] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'confirm' as 'alert' | 'confirm',
    title: '',
    message: '',
    confirmText: 'OK',
    onConfirm: () => {},
  });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));

  const clearImage = () => {
    setPreviewUrl(null);
    setFileToUpload(null);
  };

  const resetForm = () => {
    setStoreName('');
    setAmount('');
    setCategory('food');
    setIsExcluded(false);
    clearImage();
  };

  const handleFile = async (file: File) => {
    setIsScanning(true);

    let processFile: File;
    try {
      processFile = await normalizeImage(file);
    } catch (e) {
      console.error('HEIC変換エラー:', e);
      alert('画像の形式変換に失敗しました。');
      setIsScanning(false);
      return;
    }

    setFileToUpload(processFile);
    setPreviewUrl(URL.createObjectURL(processFile));

    try {
      const data = await scanReceipt(processFile);
      if (data.store_name) setStoreName(data.store_name);
      if (data.amount) setAmount(String(data.amount));
      if (data.date) setPurchaseDate(data.date);
      if (data.category) setCategory(normalizeCategory(data.category));
    } catch (error) {
      console.error('Scan error:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    if (!storeName || !amount || !purchaseDate) {
      alert('必須項目を入力してください');
      return;
    }
    setIsSaving(true);

    try {
      // DEMOモードなら保存処理をスキップ
      if (isDemoMode) {
        setTimeout(() => {
          setIsSaving(false);
          resetForm();
          setModalConfig({
            isOpen: true,
            type: 'alert',
            title: 'DEMO登録完了 ✨',
            message: 'デモモードのためデータは保存されませんが、\n正常に動作することを確認しました！',
            confirmText: 'OK',
            onConfirm: () => closeModal(),
          });
        }, 1000); // 少し待って保存した感を出す
        return;
      }

      // --- 本番用の保存処理 ---
      const uploadedUrl = fileToUpload ? await uploadReceipt(fileToUpload, householdId) : null;

      const { error } = await supabase.from('expenses').insert({
        store_name: storeName,
        amount: Number(amount),
        purchase_date: purchaseDate,
        paid_by: myUserId,
        category: category,
        receipt_url: uploadedUrl,
        is_excluded: isExcluded,
      });

      if (error) throw error;

      resetForm();
      setModalConfig({
        isOpen: true,
        type: 'alert',
        title: '登録完了 ✨',
        message: '支出を記録しました！',
        confirmText: 'OK',
        onConfirm: () => closeModal(),
      });

    } catch (error) {
      console.error('Save error:', error);
      alert('保存に失敗しました');
    } finally {
      // DEMOモードの場合はsetTimeout内でfalseにするので、ここは本番時のみ有効
      if (!isDemoMode) setIsSaving(false);
    }
  };

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <PageShell isDemoMode={isDemoMode}>
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.confirmText}
      />

      <PageHeader
        title="支出の記録"
        subtitle={`${myUserName} として記録します`}
        isDemoMode={isDemoMode}
        actions={
          <Link href="/household" className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-700 px-2 py-1.5 rounded-full hover:bg-white transition-colors">
            <Users size={13} /> ふたりの家計
          </Link>
        }
      />

      {/* 相手がまだ参加していなければ招待を促す */}
      {!isDemoMode && !partner && (
        <Link href="/household" className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-100 hover:bg-rose-100/70 transition-colors">
          <span className="flex items-center gap-3">
            <span className="p-2 rounded-full bg-white text-rose-500"><UserPlus size={16} /></span>
            <span>
              <span className="block text-sm font-bold text-slate-700">パートナーを招待する</span>
              <span className="block text-[10px] text-slate-500">招待リンクを送ると、ふたりで記録・精算できます</span>
            </span>
          </span>
          <ChevronRight size={16} className="text-rose-300 shrink-0" />
        </Link>
      )}

      <Card className="p-5">
        <ReceiptCapture previewUrl={previewUrl} isScanning={isScanning} onFile={handleFile} onClear={clearImage} />

        <SectionTitle>内容</SectionTitle>
        <div className="space-y-4">
          <Field label="店名 / 内容">
            <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="コンビニ, スーパーなど" className={inputClass} />
          </Field>
          <div className="flex flex-col min-[360px]:flex-row gap-3">
            <Field label="金額 (円)" className="flex-1 min-w-0">
              <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`${inputClass} text-right text-xl font-black tabular`} />
            </Field>
            <Field label="日付" className="w-full min-[360px]:w-[46%] shrink-0">
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={`${inputClass} !px-3 text-sm h-[56px]`} />
            </Field>
          </div>
          <Field label="カテゴリ">
            <CategoryPicker context="shared" value={category} onChange={setCategory} />
          </Field>
          <ExcludedToggle value={isExcluded} onChange={setIsExcluded} />
        </div>

        <button onClick={handleSave} disabled={isSaving} className={`${buttonClass.primary} w-full mt-6 py-4 text-base`}>
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check strokeWidth={3} size={20} />}記録する
        </button>
      </Card>

      {/* ハーンPay などは外部連携がないので、利用履歴のスクショからまとめて取り込む */}
      <Link href="/import" className="mt-4 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/70 border border-white shadow-sm hover:bg-white transition-colors">
        <span className="flex items-center gap-3">
          <span className="p-2 rounded-full bg-slate-100 text-slate-500"><Smartphone size={16} /></span>
          <span>
            <span className="block text-sm font-bold text-slate-700">決済アプリの履歴から取り込む</span>
            <span className="block text-[10px] text-slate-400">ハーンPayなどのスクショからまとめて登録</span>
          </span>
        </span>
        <ChevronRight size={16} className="text-slate-300 shrink-0" />
      </Link>
    </PageShell>
  );
}
