'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import ExcludedToggle from '../../components/ExcludedToggle';
import { ExcludedChip } from '../../components/ExcludedToggle';
import SettledChip from '../../components/SettledChip';
import ReceiptCapture from '../../components/ReceiptCapture';
import { PageShell, PageHeader, Card, SectionTitle, Field, CategoryPicker, ChoiceButton, SettlementCard, CategoryBreakdown, EmptyState, Loading, buttonClass, inputClass } from '../../components/ui';
import { Check, Loader2, Paperclip, Pencil, Trash2, CheckCheck } from 'lucide-react';
import { Trip, TripExpense, formatTripPeriod, remainingDays } from '../../lib/trips';
import { BudgetCard } from '../../components/BudgetCard';
import { findCategory, normalizeCategory, sumByCategory } from '../../lib/categories';
import { normalizeImage, scanReceipt, uploadReceipt, removeReceipts } from '../../lib/receipt';
import { DEMO_TRIPS, DEMO_TRIP_EXPENSES } from '../../lib/demoData';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { todayYMD } from '../../lib/date';


// 旅行期間外に今日の日付が入ると紛らわしいので、期間外なら開始日にする
const defaultDateFor = (trip: Trip | null) => {
  const today = todayYMD();
  if (!trip?.start_date) return today;
  if (today < trip.start_date) return trip.start_date;
  if (trip.end_date && today > trip.end_date) return trip.start_date;
  return today;
};

// ダイアログの入力欄の既定値。予算入力で数字キーボードにしたあと、ほかのダイアログに残らないように毎回入れ直す
const PROMPT_DEFAULTS = { inputMode: 'text' as 'text' | 'numeric', placeholder: '' };

const formatYMD = (ymd: string) => ymd ? ymd.replaceAll('-', '/') : '';

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tripId = Number(params.id);

  const formRef = useRef<HTMLDivElement>(null);

  const { isDemoMode, myUserName } = useCurrentUser();
  const [partnerName, setPartnerName] = useState('');

  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 入力フォーム (editingId があれば編集中)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayYMD());
  const [category, setCategory] = useState('eatout');
  const [paidBy, setPaidBy] = useState('');
  const currentPaidBy = paidBy || myUserName;
  const [isExcluded, setIsExcluded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);


  const [modalConfig, setModalConfig] = useState({
    inputMode: 'text' as 'text' | 'numeric',
    placeholder: '',
    isOpen: false,
    type: 'confirm' as 'alert' | 'confirm' | 'prompt',
    title: '',
    message: '',
    confirmText: 'OK',
    defaultValue: '',
    onConfirm: (() => {}) as (value?: string) => void,
  });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));

  // 「相手が払った」も選べるように、もう1人の名前を取っておく
  useEffect(() => {
    if (!myUserName) return;
    let cancelled = false;
    if (isDemoMode) {
      Promise.resolve().then(() => { if (!cancelled) setPartnerName('パートナー'); });
      return () => { cancelled = true; };
    }
    supabase.from('users').select('name').neq('name', myUserName).order('id').limit(1).then(({ data }) => {
      if (!cancelled && data?.[0]) setPartnerName(data[0].name);
    });
    return () => { cancelled = true; };
  }, [myUserName, isDemoMode]);

  const fetchTrip = useCallback(async () => {
    if (isDemoMode) {
      const demoTrip = DEMO_TRIPS.find((t) => t.id === tripId) ?? null;
      setTrip(demoTrip);
      setNotFound(!demoTrip);
      setExpenses(DEMO_TRIP_EXPENSES.filter((e) => e.trip_id === tripId));
      setPurchaseDate(defaultDateFor(demoTrip));
      setLoading(false);
      return;
    }

    const { data: tripData, error: tripError } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (tripError || !tripData) {
      if (tripError) console.error(tripError);
      setNotFound(true);
      setLoading(false);
      return;
    }
    setTrip(tripData);
    setPurchaseDate(defaultDateFor(tripData));

    const { data: expensesData, error: expensesError } = await supabase
      .from('trip_expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (expensesError) console.error(expensesError);
    else setExpenses(expensesData || []);

    setLoading(false);
  }, [tripId, isDemoMode]);

  useEffect(() => {
    if (myUserName) fetchTrip();
  }, [myUserName, fetchTrip]);

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
    setPaidBy('');
    setIsExcluded(false);
    setPurchaseDate(defaultDateFor(trip));
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
      const values = {
        store_name: storeName,
        amount: Number(amount),
        purchase_date: purchaseDate,
        paid_by: currentPaidBy,
        category,
        is_excluded: isExcluded,
      };

      if (editingId) {
        const update: typeof values & { receipt_url?: string | null } = { ...values };
        if (fileToUpload) {
          update.receipt_url = await uploadReceipt(fileToUpload);
          const old = expenses.find((e) => e.id === editingId)?.receipt_url;
          if (update.receipt_url && old) await removeReceipts([old]);
        }
        const { error } = await supabase.from('trip_expenses').update(update).eq('id', editingId);
        if (error) throw error;
      } else {
        const receiptUrl = fileToUpload ? await uploadReceipt(fileToUpload) : null;
        const { error } = await supabase.from('trip_expenses').insert({ ...values, trip_id: tripId, receipt_url: receiptUrl });
        if (error) throw error;
      }

      resetForm();
      fetchTrip();
    } catch (error) {
      console.error('Save error:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (item: TripExpense) => {
    if (checkDemo()) return;
    clearImage();
    setEditingId(item.id);
    setStoreName(item.store_name);
    setAmount(String(item.amount));
    setPurchaseDate(item.purchase_date);
    setCategory(item.category || 'other');
    setPaidBy(item.paid_by);
    setIsExcluded(item.is_excluded);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // おごり・精算済みの切り替え。画面を先に変えて、保存に失敗したら戻す
  const handleToggleFlag = async (item: TripExpense, key: 'is_excluded' | 'is_settled') => {
    if (checkDemo()) return;
    const next = !item[key];
    setExpenses((prev) => prev.map((e) => (e.id === item.id ? { ...e, [key]: next } : e)));
    const { error } = await supabase.from('trip_expenses').update({ [key]: next }).eq('id', item.id);
    if (error) {
      console.error(error);
      setExpenses((prev) => prev.map((e) => (e.id === item.id ? { ...e, [key]: !next } : e)));
      alert('更新に失敗しました');
    }
  };

  const handleSettleAllClick = () => {
    if (checkDemo()) return;
    const ids = expenses.filter((e) => !e.is_settled).map((e) => e.id);
    setModalConfig({
      ...PROMPT_DEFAULTS,
      isOpen: true, type: 'confirm', title: 'まとめて精算済みにする', message: `未精算の記録 ${ids.length}件を、すべて精算済みにします。`, confirmText: '精算済みにする', defaultValue: '',
      onConfirm: async () => {
        closeModal();
        const { error } = await supabase.from('trip_expenses').update({ is_settled: true }).in('id', ids);
        if (error) { console.error(error); alert('更新に失敗しました'); return; }
        setExpenses((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, is_settled: true } : e)));
      },
    });
  };

  const handleDeleteClick = (item: TripExpense) => {
    if (checkDemo()) return;
    setModalConfig({
      ...PROMPT_DEFAULTS,
      isOpen: true, type: 'confirm', title: '記録の削除', message: `「${item.store_name}」を削除してもよろしいですか？`, confirmText: '削除する', defaultValue: '',
      onConfirm: async () => {
        closeModal();
        const { error } = await supabase.from('trip_expenses').delete().eq('id', item.id);
        if (error) { console.error(error); alert('削除に失敗しました'); return; }
        await removeReceipts([item.receipt_url]);
        if (editingId === item.id) resetForm();
        setExpenses((prev) => prev.filter((e) => e.id !== item.id));
      },
    });
  };

  // ---------- 旅行そのものの操作 ----------

  const handleRenameClick = () => {
    if (checkDemo() || !trip) return;
    setModalConfig({
      ...PROMPT_DEFAULTS,
      isOpen: true, type: 'prompt', title: '旅行名の変更', message: '', confirmText: '変更する', defaultValue: trip.name,
      onConfirm: async (value) => {
        closeModal();
        const newName = value?.trim();
        if (!newName || newName === trip.name) return;
        const { error } = await supabase.from('trips').update({ name: newName, updated_at: new Date().toISOString() }).eq('id', trip.id);
        if (error) { console.error(error); alert('変更に失敗しました'); return; }
        setTrip({ ...trip, name: newName });
      },
    });
  };

  const handleBudgetClick = () => {
    if (checkDemo() || !trip) return;
    setModalConfig((prev) => ({
      ...prev,
      isOpen: true, type: 'prompt', title: trip.budget === null ? '予算を設定' : '予算の変更',
      message: 'この旅行で使う目標の金額（円）\n空にすると予算を外します',
      confirmText: '保存する', defaultValue: trip.budget === null ? '' : String(trip.budget),
      inputMode: 'numeric', placeholder: '例: 100000',
      onConfirm: async (value) => {
        closeModal();
        // 「10,000」「１００００」のような入力も受け付ける
        const digits = (value ?? '').normalize('NFKC').replace(/[^0-9]/g, '');
        const budget = digits ? Number(digits) : null;
        if (budget === trip.budget) return;
        const { error } = await supabase.from('trips').update({ budget, updated_at: new Date().toISOString() }).eq('id', trip.id);
        if (error) { console.error(error); alert('保存に失敗しました'); return; }
        setTrip({ ...trip, budget });
      },
    }));
  };

  const handleDeleteTripClick = () => {
    if (checkDemo() || !trip) return;
    setModalConfig({
      ...PROMPT_DEFAULTS,
      isOpen: true, type: 'confirm', title: '旅行の削除', message: `「${trip.name}」と、その記録 ${expenses.length}件をすべて削除します。\n元に戻せません。`, confirmText: '削除する', defaultValue: '',
      onConfirm: async () => {
        closeModal();
        // 記録は on delete cascade で消えるが、画像は自分で消す
        const { data } = await supabase.from('trip_expenses').select('receipt_url').eq('trip_id', trip.id);
        const { error } = await supabase.from('trips').delete().eq('id', trip.id);
        if (error) { console.error(error); alert('削除に失敗しました'); return; }
        await removeReceipts((data || []).map((d) => d.receipt_url));
        router.push('/trips');
      },
    });
  };

  const handleStatusClick = (type: 'paid' | 'received') => {
    if (checkDemo() || !trip) return;
    const isPaidAction = type === 'paid';
    const willBeActive = isPaidAction ? !trip.is_paid : !trip.is_received;
    let title = '', message = '', confirmText = '';

    if (isPaidAction) {
      if (willBeActive) {
        title = '支払い完了の確認'; message = '相手への支払いは完了しましたか？\nステータスを「支払い済み」に変更します。'; confirmText = '完了とする';
      } else {
        title = '支払いの取り消し'; message = '「支払い済み」ステータスを取り消して元に戻しますか？'; confirmText = '取り消す';
      }
    } else {
      if (willBeActive) {
        title = '精算完了の確認'; message = '相手からの受け取りを確認しましたか？\nこれを押すとこの旅行の精算は完了となります。'; confirmText = '精算完了';
      } else {
        title = '受け取りの取り消し'; message = '「精算完了」ステータスを取り消して元に戻しますか？'; confirmText = '取り消す';
      }
    }

    setModalConfig({ ...PROMPT_DEFAULTS, isOpen: true, type: 'confirm', title, message, confirmText, defaultValue: '', onConfirm: () => executeToggleStatus(type) });
  };

  const executeToggleStatus = async (type: 'paid' | 'received') => {
    closeModal();
    if (!trip) return;
    const prev = trip;
    const next = { ...trip };
    if (type === 'paid') next.is_paid = !next.is_paid;
    if (type === 'received') next.is_received = !next.is_received;
    setTrip(next);
    const { error } = await supabase.from('trips').update({ is_paid: next.is_paid, is_received: next.is_received, updated_at: new Date().toISOString() }).eq('id', trip.id);
    if (error) { console.error(error); setTrip(prev); alert('更新失敗'); }
  };

  // ---------- 集計 ----------
  // おごり(is_excluded)は払った人の自腹扱いなので、割り勘には入れない。
  // 精算済み(is_settled)は途中精算で片付いた分なので、残りの精算額には入れない。
  // カテゴリ別の集計は「使ったお金」なので精算済みも含める。
  const included = expenses.filter((e) => !e.is_excluded);
  const excluded = expenses.filter((e) => e.is_excluded);
  const unsettled = included.filter((e) => !e.is_settled);
  const settled = included.filter((e) => e.is_settled);
  const totalMe = unsettled.filter((e) => e.paid_by === myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalPartner = unsettled.filter((e) => e.paid_by !== myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = totalMe + totalPartner;
  const excludedAmount = excluded.reduce((sum, e) => sum + e.amount, 0);
  const settledAmount = settled.reduce((sum, e) => sum + e.amount, 0);
  // 予算と比べるのは、おごり・精算済みも含めた支出すべて
  const spentTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const splitAmount = Math.round(totalAmount / 2);
  const balance = totalMe - splitAmount;

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  if (notFound) {
    return (
      <PageShell isDemoMode={isDemoMode} tone="trip">
        <PageHeader title="旅行" back={{ href: '/trips', label: '旅行一覧' }} />
        <EmptyState icon="🧳" title="旅行が見つかりませんでした" description="削除されたか、URLが間違っている可能性があります" />
      </PageShell>
    );
  }

  return (
    <PageShell isDemoMode={isDemoMode} tone="trip">
      <Modal isOpen={modalConfig.isOpen} onClose={closeModal} type={modalConfig.type} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} confirmText={modalConfig.confirmText} defaultValue={modalConfig.defaultValue} inputMode={modalConfig.inputMode} placeholder={modalConfig.placeholder} />

      <PageHeader
        title={trip?.name ?? '　'}
        subtitle={trip ? formatTripPeriod(trip) : undefined}
        isDemoMode={isDemoMode}
        back={{ href: '/trips', label: '旅行一覧' }}
        actions={trip && (
          <>
            <button onClick={handleRenameClick} className={buttonClass.icon} aria-label="旅行名を変更"><Pencil size={17} /></button>
            <button onClick={handleDeleteTripClick} className={`${buttonClass.icon} hover:!text-rose-500`} aria-label="旅行を削除"><Trash2 size={17} /></button>
          </>
        )}
      />

      {loading || !trip ? <Loading /> : (
        <>
          <SettlementCard
            balance={balance}
            isPaid={trip.is_paid}
            isReceived={trip.is_received}
            isDemoMode={isDemoMode}
            caption="この旅行の精算"
            onStatusClick={handleStatusClick}
            zeroLabel={unsettled.length === 0 && settled.length > 0 ? '精算済み' : '精算なし'}
            rows={[
              { label: settled.length > 0 ? '未精算の割り勘対象' : '割り勘の対象', value: totalAmount },
              { label: '1人あたり (÷2)', value: splitAmount },
              { label: 'あなたの立替', value: totalMe },
              { label: '相手の立替', value: totalPartner },
              { label: '差額', value: balance, signed: true, highlight: true },
            ]}
            notes={<>
              {settled.length > 0 && <p>※ 精算済み {settled.length}件（{settledAmount.toLocaleString()}円）は計算に含めていません</p>}
              {excluded.length > 0 && <p>※ おごり {excluded.length}件（{excludedAmount.toLocaleString()}円）は計算に含めていません</p>}
            </>}
          />

          <BudgetCard budget={trip.budget} spent={spentTotal} days={remainingDays(trip, todayYMD())} onEdit={handleBudgetClick} />

          <CategoryBreakdown title="カテゴリ別" items={sumByCategory(included)} />

          {/* 入力フォーム */}
          <div ref={formRef} className="scroll-mt-4 mb-8">
            <Card className={`p-5 ${editingId ? 'ring-2 ring-sky-300' : ''}`}>
              <SectionTitle tone="trip" right={editingId && <button onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-slate-600">編集をやめる</button>}>
                {editingId ? '記録の編集' : '支出の記録'}
              </SectionTitle>

              <ReceiptCapture previewUrl={previewUrl} isScanning={isScanning} onFile={handleFile} onClear={clearImage} compact />

              <div className="space-y-4">
                <Field label="店名 / 内容">
                  <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="新幹線, 旅館など" className={inputClass} />
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
                  <CategoryPicker context="trip" value={category} onChange={setCategory} />
                </Field>
                <Field label="支払った人">
                  <div className="grid grid-cols-2 gap-2">
                    {[myUserName, partnerName].filter(Boolean).map((name) => (
                      <ChoiceButton key={name} selected={currentPaidBy === name} onClick={() => setPaidBy(name)} className="py-2.5 text-sm font-bold truncate px-2">
                        {name}{name === myUserName && '（自分）'}
                      </ChoiceButton>
                    ))}
                  </div>
                </Field>
                <ExcludedToggle value={isExcluded} onChange={setIsExcluded} />
              </div>

              <button onClick={handleSave} disabled={isSaving} className={`${buttonClass.primary} w-full mt-6 py-4 text-base`}>
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check strokeWidth={3} size={20} />}{editingId ? '更新する' : '記録する'}
              </button>
            </Card>
          </div>

          {/* 履歴 */}
          <div className="flex items-center justify-between gap-3 mb-3 ml-1">
            <h3 className="font-black text-slate-800 flex items-baseline gap-2 min-w-0 whitespace-nowrap">この旅行の記録<span className="text-xs font-bold text-slate-400">{expenses.length}件</span></h3>
            {expenses.some((e) => !e.is_settled) && (
              <button onClick={handleSettleAllClick} className="shrink-0 whitespace-nowrap flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-full hover:bg-emerald-50 transition-colors"><CheckCheck size={13} strokeWidth={2.5} />まとめて精算済みに</button>
            )}
          </div>
          {expenses.length === 0 ? (
            <EmptyState icon="🧾" title="まだ記録がありません" description="レシートを撮るか、上のフォームから入力してください" />
          ) : (
            <ul className="space-y-3">
              {expenses.map((item) => {
                const isMe = item.paid_by === myUserName;
                const cat = findCategory(item.category);
                return (
                  <li key={item.id}>
                    <Card className={`p-4 ${item.is_excluded ? '!bg-amber-50/70 !border-amber-100' : item.is_settled ? '!bg-emerald-50/50 !border-emerald-100' : ''} ${editingId === item.id ? 'ring-2 ring-sky-300' : ''}`}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-2.5 min-[360px]:gap-3 min-w-0">
                          <span className="text-xl w-10 h-10 min-[360px]:text-2xl min-[360px]:w-12 min-[360px]:h-12 shrink-0 flex items-center justify-center bg-slate-100 rounded-2xl">{cat.icon}</span>
                          <div className="min-w-0">
                            <div className="flex items-start gap-1.5">
                              <p className="font-black text-slate-800 leading-snug line-clamp-2 [overflow-wrap:anywhere] [line-break:strict]">{item.store_name || '店名なし'}</p>
                              {item.receipt_url && (
                                <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700 shrink-0" aria-label="レシート画像を開く"><Paperclip size={14} /></a>
                              )}
                            </div>
                            <p className="text-slate-400 text-[11px] font-bold tabular">{formatYMD(item.purchase_date)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-black text-lg tabular ${item.is_excluded ? 'text-slate-400 line-through decoration-slate-300' : item.is_settled ? 'text-slate-400' : 'text-slate-800'}`}>¥{item.amount.toLocaleString()}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isMe ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-500'}`}>{item.paid_by}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                        <SettledChip settled={item.is_settled} onClick={() => handleToggleFlag(item, 'is_settled')} />
                        <ExcludedChip excluded={item.is_excluded} onClick={() => handleToggleFlag(item, 'is_excluded')} />
                        <div className="ml-auto flex">
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
