'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import ExcludedToggle from '../../components/ExcludedToggle';
import { ArrowLeft, Camera, Upload, Check, Loader2, X, Paperclip, Send, Clock, CheckCircle2, ChevronDown, ChevronUp, HelpCircle, Lock, Pencil, Trash2, Gift } from 'lucide-react';
import { Trip, TripExpense, TRIP_CATEGORIES, getTripCategory, toTripCategory, formatTripPeriod } from '../../lib/trips';
import { normalizeImage, scanReceipt, uploadReceipt, removeReceipts } from '../../lib/receipt';
import { DEMO_TRIPS, DEMO_TRIP_EXPENSES } from '../../lib/demoData';
import { useCurrentUser } from '../../lib/useCurrentUser';

const todayYMD = () => new Date().toISOString().split('T')[0];

// 旅行期間外に今日の日付が入ると紛らわしいので、期間外なら開始日にする
const defaultDateFor = (trip: Trip | null) => {
  const today = todayYMD();
  if (!trip?.start_date) return today;
  if (today < trip.start_date) return trip.start_date;
  if (trip.end_date && today > trip.end_date) return trip.start_date;
  return today;
};

const formatYMD = (ymd: string) => ymd ? ymd.replaceAll('-', '/') : '';

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tripId = Number(params.id);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
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
  const [category, setCategory] = useState('meal');
  const [paidBy, setPaidBy] = useState('');
  const currentPaidBy = paidBy || myUserName;
  const [isExcluded, setIsExcluded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showDetails, setShowDetails] = useState(false);

  const [modalConfig, setModalConfig] = useState({
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
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const resetForm = () => {
    setEditingId(null);
    setStoreName('');
    setAmount('');
    setCategory('meal');
    setPaidBy('');
    setIsExcluded(false);
    setPurchaseDate(defaultDateFor(trip));
    clearImage();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      setCategory(toTripCategory(data.category));
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

  const handleToggleExcluded = async (item: TripExpense) => {
    if (checkDemo()) return;
    const next = !item.is_excluded;
    setExpenses((prev) => prev.map((e) => (e.id === item.id ? { ...e, is_excluded: next } : e)));
    const { error } = await supabase.from('trip_expenses').update({ is_excluded: next }).eq('id', item.id);
    if (error) {
      console.error(error);
      setExpenses((prev) => prev.map((e) => (e.id === item.id ? { ...e, is_excluded: !next } : e)));
      alert('更新に失敗しました');
    }
  };

  const handleDeleteClick = (item: TripExpense) => {
    if (checkDemo()) return;
    setModalConfig({
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

  const handleDeleteTripClick = () => {
    if (checkDemo() || !trip) return;
    setModalConfig({
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

    setModalConfig({ isOpen: true, type: 'confirm', title, message, confirmText, defaultValue: '', onConfirm: () => executeToggleStatus(type) });
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
  // おごり(is_excluded)は払った人の自腹扱いなので、割り勘には入れない
  const included = expenses.filter((e) => !e.is_excluded);
  const excluded = expenses.filter((e) => e.is_excluded);
  const totalMe = included.filter((e) => e.paid_by === myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalPartner = included.filter((e) => e.paid_by !== myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = totalMe + totalPartner;
  const excludedAmount = excluded.reduce((sum, e) => sum + e.amount, 0);
  const splitAmount = Math.round(totalAmount / 2);
  const balance = totalMe - splitAmount;
  const isPayer = balance < 0;
  const isReceiver = balance > 0;
  const isSettled = !!trip?.is_received;

  const categoryTotals = TRIP_CATEGORIES
    .map((cat) => ({ ...cat, value: included.filter((e) => (e.category || 'other') === cat.id).reduce((sum, e) => sum + e.amount, 0) }))
    .filter((c) => c.value > 0);

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100"></div>;

  const pageBg = isDemoMode ? 'bg-orange-50/50' : 'bg-gradient-to-br from-sky-50 to-slate-100';

  if (notFound) {
    return (
      <div className={`px-4 py-6 max-w-md mx-auto min-h-screen text-center ${pageBg}`}>
        <p className="mt-24 text-4xl mb-3">🧳</p>
        <p className="font-bold text-slate-500 mb-6">旅行が見つかりませんでした</p>
        <button onClick={() => router.push('/trips')} className="text-sm font-bold text-slate-600 bg-white border border-slate-200 px-5 py-2.5 rounded-full shadow-sm">旅行一覧へ</button>
      </div>
    );
  }

  return (
    <div className={`px-4 py-6 sm:p-8 max-w-md mx-auto min-h-screen text-gray-700 relative pb-32 font-medium transition-colors duration-500 ${pageBg}`}>
      {isDemoMode && (
        <div className="fixed top-0 left-0 w-full bg-orange-400 text-white text-xs font-bold text-center py-1 z-50 shadow-md">
          🚧 DEMO MODE - データは保存されません
        </div>
      )}

      <Modal isOpen={modalConfig.isOpen} onClose={closeModal} type={modalConfig.type} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} confirmText={modalConfig.confirmText} defaultValue={modalConfig.defaultValue} />

      <div className="mt-4 mb-6">
        <button onClick={() => router.push('/trips')} className="text-xs font-bold text-slate-500 bg-white/80 backdrop-blur-md border border-white/40 px-3 py-1.5 rounded-full hover:bg-white transition-all shadow-sm flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> 旅行一覧
        </button>
        {trip && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-700 tracking-tight break-words flex items-center gap-2 flex-wrap">
                {trip.name}
                {isDemoMode && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full border border-orange-200">DEMO</span>}
              </h1>
              <p className="text-xs font-mono font-bold text-slate-400 mt-1">{formatTripPeriod(trip)}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={handleRenameClick} className="p-2 rounded-full text-slate-400 hover:text-sky-500 hover:bg-white transition" title="旅行名を変更"><Pencil size={16} /></button>
              <button onClick={handleDeleteTripClick} className="p-2 rounded-full text-slate-400 hover:text-rose-500 hover:bg-white transition" title="旅行を削除"><Trash2 size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {loading || !trip ? (
        <div className="text-center py-12 text-slate-600 font-bold animate-pulse">読み込み中...</div>
      ) : (
        <>
          {/* 精算カード */}
          <div className={`p-6 sm:p-8 rounded-3xl text-white shadow-[0_10px_40px_rgb(0,0,0,0.15)] border border-white/20 mb-6 transition-all relative overflow-hidden ${isSettled ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : balance === 0 ? 'bg-gradient-to-br from-gray-500 to-gray-600' : balance > 0 ? 'bg-gradient-to-br from-slate-500 to-slate-600' : 'bg-gradient-to-br from-rose-400 to-rose-500'}`}>
            <div className="absolute inset-0 bg-white/10 mix-blend-overlay pointer-events-none"></div>

            <div className="relative z-10 mb-4 flex flex-col items-center">
              {isSettled ? (
                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-md mb-2">
                  <CheckCircle2 size={20} className="text-white" />
                  <span className="font-bold">精算完了</span>
                  {isReceiver && (
                    <button onClick={() => handleStatusClick('received')} className="ml-2 bg-white/20 p-1 rounded-full hover:bg-white/40">
                      {isDemoMode ? <Lock size={14} /> : <X size={14} />}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {isPayer && (
                    <button onClick={() => handleStatusClick('paid')} className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md mb-2 font-bold transition-all ${trip.is_paid ? 'bg-white/30 text-white' : 'bg-white text-rose-500 shadow-lg'} ${isDemoMode ? 'opacity-80 cursor-not-allowed' : ''}`}>
                      {trip.is_paid ? (<><Clock size={18} /> <span className="whitespace-nowrap">支払い報告済み</span></>) : (<><Send size={18} /> 支払いを完了する</>)}
                    </button>
                  )}
                  {isReceiver && (
                    <div className="flex flex-col items-center gap-2">
                      {trip.is_paid && <span className="text-xs bg-white/20 px-3 py-1 rounded-full animate-pulse">相手が「支払い済み」にしました</span>}
                      <button onClick={() => handleStatusClick('received')} className={`flex items-center gap-2 bg-white text-slate-600 px-6 py-3 rounded-full shadow-lg font-bold hover:bg-slate-50 transition-all active:scale-95 ${isDemoMode ? 'opacity-80 cursor-not-allowed' : ''}`}>
                        <CheckCircle2 size={20} className="text-emerald-500" /> <span className="whitespace-nowrap">受け取り完了</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="text-xs sm:text-sm font-bold opacity-90 mb-2 relative z-10 text-center">この旅行の精算</p>
            <h2 className="text-2xl sm:text-4xl font-black mb-4 relative z-10 drop-shadow-sm leading-tight text-center">
              {balance === 0 ? '精算なし' : (
                <>相手{balance > 0 ? 'から' : 'へ'}<br className="sm:hidden" /><span className="mx-1 sm:mx-3 underline underline-offset-8 decoration-white/50">{Math.abs(balance).toLocaleString()}</span>円{balance > 0 ? 'もらう' : '払う'}</>
              )}
            </h2>

            <div className="mt-4 bg-black/20 rounded-xl overflow-hidden relative z-10">
              <button onClick={() => setShowDetails(!showDetails)} className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold hover:bg-white/5 transition-colors">
                <span className="flex items-center gap-2"><HelpCircle size={14} /> 計算の内訳を見る</span>
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showDetails && (
                <div className="px-4 pb-4 pt-1 text-xs space-y-2 opacity-90 border-t border-white/10">
                  <div className="flex justify-between border-b border-white/10 py-1"><span>割り勘の対象</span><span className="font-mono">{totalAmount.toLocaleString()} 円</span></div>
                  <div className="flex justify-between border-b border-white/10 py-1"><span>1人あたり (÷2)</span><span className="font-mono">{splitAmount.toLocaleString()} 円</span></div>
                  <div className="flex justify-between border-b border-white/10 py-1"><span>あなたの立替済</span><span className="font-mono">{totalMe.toLocaleString()} 円</span></div>
                  <div className="flex justify-between border-b border-white/10 py-1"><span>相手の立替済</span><span className="font-mono">{totalPartner.toLocaleString()} 円</span></div>
                  <div className="flex justify-between py-1 text-emerald-200"><span>差額</span><span className="font-mono">{balance > 0 ? '+' : ''}{balance.toLocaleString()} 円</span></div>
                  {excluded.length > 0 && (
                    <div className="pt-2 text-[10px] text-center opacity-80">※ おごり {excluded.length}件（{excludedAmount.toLocaleString()}円）は計算に含めていません</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* カテゴリ別 */}
          {categoryTotals.length > 0 && (
            <div className="bg-white/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-6">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-bold text-sm text-slate-700">カテゴリ別</h3>
                <span className="text-xs font-bold text-slate-400">割り勘対象 ¥{totalAmount.toLocaleString()}</span>
              </div>
              <ul className="space-y-2">
                {categoryTotals.map((cat) => (
                  <li key={cat.id} className="flex items-center gap-3 text-xs">
                    <span className="w-16 shrink-0 font-bold text-slate-500">{cat.icon} {cat.label}</span>
                    <span className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><span className="block h-full bg-sky-400 rounded-full" style={{ width: `${(cat.value / totalAmount) * 100}%` }}></span></span>
                    <span className="w-20 shrink-0 text-right font-mono font-bold text-slate-600">¥{cat.value.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 入力フォーム */}
          <div ref={formRef} className="scroll-mt-4 bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-8 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-slate-700 flex items-center gap-2"><span className="w-1.5 h-5 bg-sky-500 rounded-full"></span>{editingId ? '記録の編集' : '支出の記録'}</h2>
              {editingId && <button onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-slate-600">編集をやめる</button>}
            </div>

            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} className="hidden" />
            <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleFileChange} className="hidden" />

            {previewUrl ? (
              <div className="relative mb-4">
                <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover rounded-2xl border border-white/60" />
                <button onClick={clearImage} className="absolute top-2 right-2 bg-black/50 text-white/90 p-1.5 rounded-full hover:bg-rose-500 transition-colors" title="画像を削除"><X size={16} strokeWidth={2.5} /></button>
              </div>
            ) : (
              <div className="flex gap-2 mb-4">
                <button onClick={() => cameraInputRef.current?.click()} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"><Camera size={14} className="text-sky-500" /> レシート撮影</button>
                <button onClick={() => galleryInputRef.current?.click()} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"><Upload size={14} className="text-slate-500" /> 画像を選択</button>
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-10">
                <Loader2 className="animate-spin text-sky-500 mb-3" size={32} />
                <p className="font-bold text-slate-600 text-sm animate-pulse">AIが解析中...</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">店名 / 内容</label>
                <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="新幹線, 旅館など" className="w-full p-3 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:bg-white font-bold text-slate-700 placeholder:text-slate-300 shadow-sm text-sm sm:text-base" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">金額 (円)</label>
                  <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full p-3 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:bg-white font-black text-lg text-slate-700 placeholder:text-slate-300 text-right shadow-sm h-[52px]" />
                </div>
                <div className="w-[38%] min-w-[120px]">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">日付</label>
                  <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full p-3 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:bg-white font-bold text-slate-600 text-xs h-[52px] shadow-sm text-center" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">カテゴリ</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {TRIP_CATEGORIES.map((cat) => (
                    <button key={cat.id} onClick={() => setCategory(cat.id)} className={`flex flex-col items-center justify-center py-2 rounded-2xl border transition-all active:scale-95 ${category === cat.id ? 'bg-slate-700 text-white border-slate-700 shadow-md' : 'bg-white/60 border-transparent text-slate-400 hover:bg-white'}`}>
                      <span className="text-lg mb-0.5">{cat.icon}</span>
                      <span className={`text-[9px] font-bold whitespace-nowrap ${category === cat.id ? 'text-white' : 'text-slate-400'}`}>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">支払った人</label>
                <div className="grid grid-cols-2 gap-2">
                  {[myUserName, partnerName].filter(Boolean).map((name) => (
                    <button key={name} onClick={() => setPaidBy(name)} className={`py-2.5 rounded-2xl border text-sm font-bold transition-all truncate px-2 ${currentPaidBy === name ? 'bg-slate-700 text-white border-slate-700 shadow-md' : 'bg-white/60 border-slate-200/60 text-slate-500 hover:bg-white'}`}>
                      {name}{name === myUserName && '（自分）'}
                    </button>
                  ))}
                </div>
              </div>
              <ExcludedToggle value={isExcluded} onChange={setIsExcluded} />
            </div>

            <button onClick={handleSave} disabled={isSaving} className="mt-6 w-full py-3.5 bg-slate-800 text-white font-black text-base rounded-2xl shadow-lg shadow-slate-300 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
              {isSaving ? <Loader2 className="animate-spin" /> : <Check strokeWidth={3} />}<span>{editingId ? '更新する' : '記録する'}</span>
            </button>
          </div>

          {/* 履歴 */}
          <div>
            <h3 className="font-bold mb-4 text-gray-700 ml-2 text-sm sm:text-base">この旅行の記録 ({expenses.length}件)</h3>
            {expenses.length === 0 ? (
              <p className="text-center text-gray-500 font-bold text-sm py-12 bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40">まだ記録がありません</p>
            ) : (
              <ul className="space-y-3">
                {expenses.map((item) => {
                  const isMe = item.paid_by === myUserName;
                  const cat = getTripCategory(item.category);
                  return (
                    <li key={item.id} className={`p-4 rounded-3xl shadow-sm border transition-all ${item.is_excluded ? 'bg-amber-50/60 border-amber-100' : 'bg-white/80 border-white/60'} ${editingId === item.id ? 'ring-2 ring-sky-300' : ''}`}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl bg-gray-100/80 p-2 rounded-2xl shadow-inner shrink-0">{cat.icon}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-gray-800 text-base line-clamp-1">{item.store_name || '店名なし'}</p>
                              {item.receipt_url && (
                                <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 rounded-full transition-colors shrink-0"><Paperclip size={14} /></a>
                              )}
                            </div>
                            <p className="text-gray-400 text-[10px] font-mono font-bold">{formatYMD(item.purchase_date)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-black text-lg mb-1 ${item.is_excluded ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'}`}>¥{item.amount.toLocaleString()}</p>
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold shadow-sm ${isMe ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600'}`}>{item.paid_by}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={() => handleToggleExcluded(item)} className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${item.is_excluded ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-200'}`}>
                          <Gift size={12} /> {item.is_excluded ? `${item.paid_by}のおごり` : 'おごりにする'}
                        </button>
                        <div className="ml-auto flex gap-3">
                          <button onClick={() => handleEditClick(item)} className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors">編集</button>
                          <button onClick={() => handleDeleteClick(item)} className="text-xs font-bold text-rose-400 hover:text-rose-600 transition-colors">削除</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
