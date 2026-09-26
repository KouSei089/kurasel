'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ArrowRight, Plane, Plus, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Trip, formatTripPeriod } from '../lib/trips';
import { DEMO_TRIPS, DEMO_TRIP_EXPENSES } from '../lib/demoData';
import { useCurrentUser } from '../lib/useCurrentUser';

type TripSummary = Trip & { total: number; count: number };

const DEMO_SUMMARIES: TripSummary[] = DEMO_TRIPS.map((trip) => {
  const items = DEMO_TRIP_EXPENSES.filter((e) => e.trip_id === trip.id);
  return { ...trip, total: items.reduce((sum, e) => sum + e.amount, 0), count: items.length };
});

export default function TripsPage() {
  const router = useRouter();

  const { isDemoMode, myUserName } = useCurrentUser();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!myUserName || isDemoMode) return;
    let cancelled = false;
    // 一覧では合計だけ出したいので、金額だけ一緒に取ってくる
    supabase
      .from('trips')
      .select('*, trip_expenses(amount)')
      .order('start_date', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
        } else {
          setTrips((data || []).map(({ trip_expenses, ...trip }) => ({
            ...trip,
            total: (trip_expenses as { amount: number }[]).reduce((sum, e) => sum + (e.amount || 0), 0),
            count: trip_expenses.length,
          })));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [myUserName, isDemoMode]);

  const shownTrips = isDemoMode ? DEMO_SUMMARIES : trips;
  const isLoading = !isDemoMode && loading;

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('旅行名を入力してください');
      return;
    }
    if (endDate && startDate && endDate < startDate) {
      alert('終了日は開始日以降にしてください');
      return;
    }
    if (isDemoMode) {
      alert('⚠️ DEMOモード中はこの操作はできません');
      return;
    }

    setIsCreating(true);
    const { data, error } = await supabase
      .from('trips')
      .insert({ name: name.trim(), start_date: startDate || null, end_date: endDate || null })
      .select('id')
      .single();
    setIsCreating(false);

    if (error || !data) {
      console.error(error);
      alert('作成に失敗しました');
      return;
    }
    router.push(`/trips/${data.id}`);
  };

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100"></div>;

  return (
    <div className={`px-4 py-6 sm:p-8 max-w-md mx-auto min-h-screen text-gray-700 relative pb-32 font-medium transition-colors duration-500 ${isDemoMode ? 'bg-orange-50/50' : 'bg-gradient-to-br from-sky-50 to-slate-100'}`}>
      {isDemoMode && (
        <div className="fixed top-0 left-0 w-full bg-orange-400 text-white text-xs font-bold text-center py-1 z-50 shadow-md">
          🚧 DEMO MODE - データは保存されません
        </div>
      )}

      <div className="flex justify-between items-center mb-6 sm:mb-8 mt-4">
        <h1 className="text-xl sm:text-2xl font-black text-slate-700 tracking-tight flex items-center gap-2">
          <Plane size={22} className="text-sky-500" /> 旅行
          {isDemoMode && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full border border-orange-200">DEMO</span>}
        </h1>
        <button onClick={() => router.push('/')} className="text-xs sm:text-sm font-bold text-slate-600 bg-white/80 backdrop-blur-md border border-white/40 px-3 py-2 sm:px-4 rounded-full hover:bg-white hover:-translate-y-0.5 transition-all shadow-sm flex items-center gap-1">
          <ArrowLeft size={14} /> 日常へ
        </button>
      </div>

      {isFormOpen ? (
        <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <h2 className="text-base font-black text-slate-700 mb-4 flex items-center gap-2"><span className="w-1.5 h-5 bg-sky-500 rounded-full"></span>新しい旅行</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">旅行名</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 京都 紅葉旅行" className="w-full p-3 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:bg-white font-bold text-slate-700 placeholder:text-slate-300 shadow-sm text-sm sm:text-base" autoFocus />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">開始日</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:bg-white font-bold text-slate-600 text-xs sm:text-sm h-[48px] shadow-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">終了日（任意）</label>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-sky-100 focus:bg-white font-bold text-slate-600 text-xs sm:text-sm h-[48px] shadow-sm" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-500 text-sm hover:bg-slate-50 transition">キャンセル</button>
            <button onClick={handleCreate} disabled={isCreating} className="flex-1 py-3 bg-slate-800 text-white rounded-2xl font-black text-sm shadow-lg shadow-slate-300 hover:bg-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />} 作成
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setIsFormOpen(true)} className="w-full mb-6 py-4 bg-slate-800 text-white font-black rounded-2xl shadow-lg shadow-slate-300 hover:bg-slate-700 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2">
          <Plus size={18} strokeWidth={3} /> 新しい旅行を作成
        </button>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-600 font-bold animate-pulse">読み込み中...</div>
      ) : shownTrips.length === 0 ? (
        <div className="text-center py-12 bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40">
          <p className="text-4xl mb-3">🧳</p>
          <p className="text-sm font-bold text-slate-500">まだ旅行がありません</p>
          <p className="text-xs text-slate-400 mt-1">旅行を作成すると、日常とは別に記録・精算できます</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shownTrips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/trips/${trip.id}`} className="block bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-sm border border-white/60 hover:bg-white hover:-translate-y-0.5 transition-all group">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-800 text-base sm:text-lg truncate">{trip.name}</p>
                    <p className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 mt-0.5">{formatTripPeriod(trip)}</p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <p className="font-black text-lg text-slate-700">¥{trip.total.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400">{trip.count}件</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
                <div className="mt-3">
                  {trip.is_received ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100"><CheckCircle2 size={12} /> 精算完了</span>
                  ) : trip.is_paid ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100"><Clock size={12} /> 支払い報告済み</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">未精算</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
