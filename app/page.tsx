'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabase';
import { Check, Loader2, LogOut } from 'lucide-react';
import Modal from './components/Modal';
import ExcludedToggle from './components/ExcludedToggle';
import ReceiptCapture from './components/ReceiptCapture';
import { PageShell, PageHeader, Card, SectionTitle, Field, CategoryPicker, buttonClass, inputClass } from './components/ui';
import { normalizeImage, scanReceipt, uploadReceipt } from './lib/receipt';
import { DAILY_CATEGORIES } from './lib/categories';
import { useCurrentUser } from './lib/useCurrentUser';

export default function Home() {
  const router = useRouter();
  const { isDemoMode, myUserName } = useCurrentUser();

  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
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

  const handleLogoutClick = () => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'ログアウト',
      message: '本当にログアウトしますか？',
      confirmText: 'ログアウト',
      onConfirm: executeLogout,
    });
  };

  const executeLogout = () => {
    closeModal();
    localStorage.removeItem('scan_io_user_name');
    localStorage.removeItem('kurasel_mode'); // モード設定も削除
    router.push('/login');
  };

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
      if (data.category) setCategory(data.category);
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
      const uploadedUrl = fileToUpload ? await uploadReceipt(fileToUpload) : null;

      const { error } = await supabase.from('expenses').insert({
        store_name: storeName,
        amount: Number(amount),
        purchase_date: purchaseDate,
        paid_by: myUserName,
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
          <button onClick={handleLogoutClick} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-500 px-2 py-1.5 rounded-full hover:bg-white transition-colors">
            <LogOut size={13} /> ログアウト
          </button>
        }
      />

      <Card className="p-5">
        <ReceiptCapture previewUrl={previewUrl} isScanning={isScanning} onFile={handleFile} onClear={clearImage} />

        <SectionTitle>内容</SectionTitle>
        <div className="space-y-4">
          <Field label="店名 / 内容">
            <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="コンビニ, スーパーなど" className={inputClass} />
          </Field>
          <div className="flex gap-3">
            <Field label="金額 (円)" className="flex-1 min-w-0">
              <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`${inputClass} text-right text-xl font-black tabular`} />
            </Field>
            <Field label="日付" className="w-[46%] shrink-0">
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={`${inputClass} !px-3 text-sm h-[56px]`} />
            </Field>
          </div>
          <Field label="カテゴリ">
            <CategoryPicker categories={DAILY_CATEGORIES} value={category} onChange={setCategory} />
          </Field>
          <ExcludedToggle value={isExcluded} onChange={setIsExcluded} />
        </div>

        <button onClick={handleSave} disabled={isSaving} className={`${buttonClass.primary} w-full mt-6 py-4 text-base`}>
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check strokeWidth={3} size={20} />}記録する
        </button>
      </Card>
    </PageShell>
  );
}
