'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { ChevronRight, Plus, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { PageShell, PageHeader, Card, SectionTitle, Field, EmptyState, Loading, buttonClass, inputClass } from '../components/ui';
import { Trip, formatTripPeriod, budgetStatus } from '../lib/trips';
import { BudgetBar } from '../components/BudgetCard';
import { DEMO_TRIPS, DEMO_TRIP_EXPENSES } from '../lib/demoData';
import { useCurrentUser } from '../lib/useCurrentUser';
import { todayYMD } from '../lib/date';

type TripSummary = Trip & { total: number; count: number };

const DEMO_SUMMARIES: TripSummary[] = DEMO_TRIPS.map((trip) => {
  const items = DEMO_TRIP_EXPENSES.filter((e) => e.trip_id === trip.id);
  return { ...trip, total: items.reduce((sum, e) => sum + e.amount, 0), count: items.length };
});

export default function TripsPage() {
  const router = useRouter();

  const { isDemoMode, myUserId, myUserName } = useCurrentUser();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayYMD);
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!myUserId || isDemoMode) return;
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
  }, [myUserId, isDemoMode]);

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
      .insert({ name: name.trim(), start_date: startDate || null, end_date: endDate || null, budget: budget ? Number(budget) : null })
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

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <PageShell isDemoMode={isDemoMode} tone="trip">
      <PageHeader title="旅行" subtitle="日常の家計とは分けて、旅行ごとに記録・精算します" isDemoMode={isDemoMode} />

      {isFormOpen ? (
        <Card className="p-5 mb-6 animate-in">
          <SectionTitle tone="trip">新しい旅行</SectionTitle>
          <div className="space-y-4">
            <Field label="旅行名">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 京都 紅葉旅行" className={inputClass} autoFocus />
            </Field>
            <div className="flex flex-col min-[360px]:flex-row gap-3">
              <Field label="開始日" className="flex-1 min-w-0">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputClass} !px-3 text-sm h-[50px]`} />
              </Field>
              <Field label="終了日（任意）" className="flex-1 min-w-0">
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} !px-3 text-sm h-[50px]`} />
              </Field>
            </div>
            <Field label="予算（任意）">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">¥</span>
                <input type="number" inputMode="numeric" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="この旅行で使う目標の金額" className={`${inputClass} pl-8 tabular`} />
              </div>
            </Field>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setIsFormOpen(false)} className={`${buttonClass.secondary} flex-1 py-3 text-sm`}>キャンセル</button>
            <button onClick={handleCreate} disabled={isCreating} className={`${buttonClass.primary} flex-1 py-3 text-sm`}>
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={3} />} 作成
            </button>
          </div>
        </Card>
      ) : (
        <button onClick={() => setIsFormOpen(true)} className={`${buttonClass.primary} w-full mb-6 py-4`}>
          <Plus size={18} strokeWidth={3} /> 新しい旅行を作成
        </button>
      )}

      {isLoading ? <Loading /> : shownTrips.length === 0 ? (
        <EmptyState icon="🧳" title="まだ旅行がありません" description="旅行を作成すると、日常とは別に記録・精算できます" />
      ) : (
        <ul className="space-y-3">
          {shownTrips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/trips/${trip.id}`} className="block group">
                <Card className="p-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center gap-3 min-[360px]:gap-4">
                    <span className="hidden min-[360px]:flex w-12 h-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-2xl">✈️</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 truncate">{trip.name}</p>
                      <p className="text-[11px] font-bold text-slate-400 tabular mb-1.5 whitespace-nowrap">{formatTripPeriod(trip)}</p>
                      {trip.is_received ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={11} /> 精算完了</span>
                      ) : trip.is_paid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600"><Clock size={11} /> 支払い報告済み</span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">未精算</span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-lg text-slate-800 tabular">¥{trip.total.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400">{trip.count}件</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-sky-500 transition-colors shrink-0" />
                  </div>
                  {trip.budget !== null && (
                    <div className="mt-3">
                      <BudgetBar budget={trip.budget} spent={trip.total} />
                      <p className={`text-[10px] font-bold mt-1 text-right tabular ${budgetStatus(trip.budget, trip.total).level === 'over' ? 'text-rose-500' : 'text-slate-400'}`}>
                        予算 ¥{trip.budget.toLocaleString()} の {Math.round(budgetStatus(trip.budget, trip.total).ratio * 100)}%
                      </p>
                    </div>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
