'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import ReceiptCapture from '../components/ReceiptCapture';
import { PageShell, PageHeader, Card, SectionTitle, Field, CategoryPicker, MonthSwitcher, CategoryBreakdown, EmptyState, Loading, buttonClass, inputClass } from '../components/ui';
import { Check, Loader2, Lock, Paperclip, Pencil, Trash2, Smartphone, Repeat, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { findCategory, normalizeCategory, sumByCategory } from '../lib/categories';
import { normalizeImage, scanReceipt, uploadReceipt, removeReceipts } from '../lib/receipt';
import { DEMO_PERSONAL_EXPENSES, DEMO_SUBSCRIPTIONS } from '../lib/demoData';
import { Subscription, monthlyAmount, syncSubscriptions, daysUntil } from '../lib/subscriptions';
import { useCurrentUser } from '../lib/useCurrentUser';
import { toLocalYMD } from '../lib/date';

// 自分だけの支出。ふたりの家計・精算とは別テーブル(personal_expenses)で、
// owner（自分のID）の記録だけを出す。DB の RLS でも本人しか読めない。

type PersonalExpense = {
  id: number;
  owner: string; // 持ち主のID
  store_name: string;
  amount: number;
  purchase_date: string;
  category: string | null;
  receipt_url: string | null;
  subscription_id?: number | null; // サブスクから自動で記録したもの
  created_at: string;
};

const formatYMD = (ymd: string) => (ymd ? ymd.replaceAll('-', '/') : '');

export default function PersonalPage() {
  const { isDemoMode, myUserId, myUserName, householdId } = useCurrentUser();
  const formRef = useRef<HTMLDivElement>(null);

  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  // 保存・削除のあとに読み直すための合図
  const [reloadKey, setReloadKey] = useState(0);

  // 入力フォーム (editingId があれば編集中)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(toLocalYMD(new Date()));
  const [category, setCategory] = useState('eatout');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'OK',
    onConfirm: () => {},
  });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (!myUserId || isDemoMode) return;
    let cancelled = false;
    const first = toLocalYMD(month);
    const last = toLocalYMD(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    supabase
      .from('personal_expenses')
      .select('*')
      .eq('owner', myUserId)
      .gte('purchase_date', first)
      .lte('purchase_date', last)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        else setExpenses(data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [myUserId, isDemoMode, month, reloadKey]);

  // サブスク: 支払日を過ぎた分を個人の支出に記録してから、まとめ用に一覧を読む。
  // 記録が増えたら支出の一覧も読み直す
  const [subscriptions, setSubscriptions] = useState<Pick<Subscription, 'id' | 'name' | 'amount' | 'cycle' | 'next_billing_date' | 'is_active'>[]>([]);
  useEffect(() => {
    if (!myUserId || isDemoMode) return;
    let cancelled = false;
    syncSubscriptions(myUserId).then((recorded) => {
      if (cancelled) return;
      if (recorded > 0) setReloadKey((k) => k + 1);
      return supabase.from('subscriptions').select('id, name, amount, cycle, next_billing_date, is_active').eq('owner', myUserId).eq('is_active', true).then(({ data }) => {
        if (!cancelled && data) setSubscriptions(data);
      });
    });
    return () => { cancelled = true; };
  }, [myUserId, isDemoMode]);

  const shownSubscriptions = isDemoMode
    ? DEMO_SUBSCRIPTIONS.filter((s) => s.is_active).map((s) => { const d = new Date(); d.setDate(d.getDate() + s.daysFromToday); return { ...s, next_billing_date: toLocalYMD(d) }; })
    : subscriptions;
  const subscriptionMonthly = shownSubscriptions.reduce((sum, s) => sum + monthlyAmount(s), 0);
  const nextSubscription = [...shownSubscriptions].sort((a, b) => a.next_billing_date.localeCompare(b.next_billing_date))[0];

  // デモは月に関係なく見本を出す（日常の精算画面と同じ扱い）
  const shownExpenses: PersonalExpense[] = isDemoMode ? DEMO_PERSONAL_EXPENSES : expenses;
  const isLoading = !isDemoMode && loading;

  const checkDemo = () => {
    if (isDemoMode) {
      alert('⚠️ DEMOモード中はこの操作はできません');
      return true;
    }
    return false;
  };

  // ---------- 入力フォーム ----------

  const clearImage = () => {
    setPreviewUrl(null);
    setFileToUpload(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setStoreName('');
    setAmount('');
    setCategory('eatout');
    setPurchaseDate(toLocalYMD(new Date()));
    clearImage();
  };

  const handleFile = async (file: File) => {
    setIsScanning(true);

    let processFile: File;
    try {
      processFile = await normalizeImage(file);
    } catch (err) {
      console.error('HEIC変換エラー:', err);
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
      setCategory(normalizeCategory(data.category));
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    if (!storeName || !amount || !purchaseDate) {
      alert('必須項目を入力してください');
      return;
    }
    if (checkDemo()) return;
    setIsSaving(true);

    try {
      const values = { store_name: storeName, amount: Number(amount), purchase_date: purchaseDate, category };

      if (editingId) {
        const update: typeof values & { receipt_url?: string | null } = { ...values };
        if (fileToUpload) {
          update.receipt_url = await uploadReceipt(fileToUpload, householdId);
          const old = expenses.find((e) => e.id === editingId)?.receipt_url;
          if (update.receipt_url && old) await removeReceipts([old]);
        }
        const { error } = await supabase.from('personal_expenses').update(update).eq('id', editingId);
        if (error) throw error;
      } else {
        const receiptUrl = fileToUpload ? await uploadReceipt(fileToUpload, householdId) : null;
        const { error } = await supabase.from('personal_expenses').insert({ ...values, owner: myUserId, receipt_url: receiptUrl });
        if (error) throw error;
      }

      resetForm();
      setReloadKey((k) => k + 1);
    } catch (error) {
      console.error('Save error:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (item: PersonalExpense) => {
    if (checkDemo()) return;
    clearImage();
    setEditingId(item.id);
    setStoreName(item.store_name);
    setAmount(String(item.amount));
    setPurchaseDate(item.purchase_date);
    setCategory(item.category || 'other');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteClick = (item: PersonalExpense) => {
    if (checkDemo()) return;
    setModalConfig({
      isOpen: true,
      title: '記録の削除',
      message: `「${item.store_name}」を削除してもよろしいですか？`,
      confirmText: '削除する',
      onConfirm: async () => {
        closeModal();
        const { error } = await supabase.from('personal_expenses').delete().eq('id', item.id);
        if (error) { console.error(error); alert('削除に失敗しました'); return; }
        await removeReceipts([item.receipt_url]);
        if (editingId === item.id) resetForm();
        setExpenses((prev) => prev.filter((e) => e.id !== item.id));
      },
    });
  };

  // ---------- 集計 ----------
  const total = shownExpenses.reduce((sum, e) => sum + e.amount, 0);

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <PageShell isDemoMode={isDemoMode} tone="personal">
      <Modal isOpen={modalConfig.isOpen} onClose={closeModal} type="confirm" title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} confirmText={modalConfig.confirmText} />

      <PageHeader
        title="個人"
        subtitle={<span className="inline-flex items-center gap-1"><Lock size={11} /> {myUserName}さんだけに表示される支出です</span>}
        isDemoMode={isDemoMode}
      />

      <MonthSwitcher month={month} onChange={(m) => { setMonth(m); setLoading(true); resetForm(); }} />

      {isLoading ? <Loading /> : (
        <>
          {/* 今月の出費 */}
          <div className="relative overflow-hidden rounded-3xl p-6 text-white bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-600/20 mb-6">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 pointer-events-none"></div>
            <p className="relative text-xs font-bold text-white/80 mb-1">{month.getMonth() + 1}月の出費</p>
            <p className="relative font-black leading-tight">
              <span className="text-4xl tabular tracking-tight">{total.toLocaleString()}</span>
              <span className="text-lg ml-1">円</span>
            </p>
            <p className="relative text-[11px] font-bold text-white/75 mt-2">{shownExpenses.length}件の記録 ・ ふたりの精算には含まれません</p>
          </div>

          <CategoryBreakdown title="カテゴリ別" items={sumByCategory(shownExpenses)} />

          {/* サブスクのまとめ。押すと管理画面へ */}
          <Link href="/personal/subscriptions" className="block mb-6 group">
            <Card className="p-4 flex items-center gap-3 transition-all group-hover:-translate-y-0.5">
              <span className="p-2.5 rounded-2xl bg-violet-50 text-violet-500 shrink-0"><Repeat size={18} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800">サブスク</p>
                <p className="text-[11px] font-bold text-slate-400 truncate">
                  {shownSubscriptions.length === 0
                    ? '登録すると、支払日に自動で記録します'
                    : nextSubscription && `次は ${nextSubscription.name}（${Math.max(daysUntil(nextSubscription.next_billing_date), 0) === 0 ? '今日' : `あと${daysUntil(nextSubscription.next_billing_date)}日`}）`}
                </p>
              </div>
              {shownSubscriptions.length > 0 && (
                <div className="text-right shrink-0">
                  <p className="font-black text-slate-800 tabular">¥{Math.round(subscriptionMonthly).toLocaleString()}<span className="text-[10px] text-slate-400">/月</span></p>
                  <p className="text-[10px] font-bold text-slate-400">{shownSubscriptions.length}件</p>
                </div>
              )}
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </Card>
          </Link>

          {/* 入力フォーム */}
          <div ref={formRef} className="scroll-mt-4 mb-8">
            <Card className={`p-5 ${editingId ? 'ring-2 ring-violet-300' : ''}`}>
              <SectionTitle tone="personal" right={editingId && <button onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-slate-600">編集をやめる</button>}>
                {editingId ? '記録の編集' : '個人の支出を記録'}
              </SectionTitle>

              <ReceiptCapture previewUrl={previewUrl} isScanning={isScanning} onFile={handleFile} onClear={clearImage} compact />

              <div className="space-y-4">
                <Field label="店名 / 内容">
                  <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="ランチ, 本, 服など" className={inputClass} />
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
                  <CategoryPicker context="personal" value={category} onChange={setCategory} />
                </Field>
              </div>

              <button onClick={handleSave} disabled={isSaving} className={`${buttonClass.primary} w-full mt-6 py-4 text-base`}>
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check strokeWidth={3} size={20} />}{editingId ? '更新する' : '記録する'}
              </button>
              {!editingId && (
                <Link href="/import?to=personal" className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 py-1">
                  <Smartphone size={14} /> ハーンPayなどの履歴から取り込む
                </Link>
              )}
            </Card>
          </div>

          {/* 履歴 */}
          <h3 className="font-black text-slate-800 mb-3 ml-1 flex items-baseline gap-2 whitespace-nowrap">履歴<span className="text-xs font-bold text-slate-400">{shownExpenses.length}件</span></h3>
          {shownExpenses.length === 0 ? (
            <EmptyState icon="🧾" title="この月の個人の記録はまだありません" />
          ) : (
            <ul className="space-y-3">
              {shownExpenses.map((item) => {
                const cat = findCategory(item.category);
                return (
                  <li key={item.id}>
                    <Card className={`p-4 flex items-center gap-2.5 min-[360px]:gap-3 ${editingId === item.id ? 'ring-2 ring-violet-300' : ''}`}>
                      <span className="text-xl w-10 h-10 min-[360px]:text-2xl min-[360px]:w-12 min-[360px]:h-12 shrink-0 flex items-center justify-center bg-slate-100 rounded-2xl">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5">
                          <p className="font-black text-slate-800 leading-snug line-clamp-2 [overflow-wrap:anywhere] [line-break:strict]">{item.store_name || '店名なし'}</p>
                          {item.receipt_url && (
                            <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700 shrink-0 mt-0.5" aria-label="レシート画像を開く"><Paperclip size={14} /></a>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px] font-bold tabular flex items-center gap-1.5">
                          {formatYMD(item.purchase_date)}
                          {item.subscription_id && <span className="inline-flex items-center gap-0.5 px-1.5 rounded-full bg-violet-50 text-violet-600"><Repeat size={10} /> 自動</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-lg text-slate-800 tabular">¥{item.amount.toLocaleString()}</p>
                        <div className="flex justify-end -mr-1.5">
                          <button onClick={() => handleEditClick(item)} className={buttonClass.icon} aria-label="編集"><Pencil size={15} /></button>
                          <button onClick={() => handleDeleteClick(item)} className={`${buttonClass.icon} hover:!text-rose-500`} aria-label="削除"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </PageShell>
  );
}
