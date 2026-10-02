import { supabase } from './supabase';
import { toLocalYMD } from './date';
import type { Income } from './income';
import { DEMO_EXPENSES, DEMO_PERSONAL_EXPENSES, DEMO_TRIPS, DEMO_TRIP_EXPENSES } from './demoData';

// 分析画面用に、ふたり・旅行・個人の支出を1つの形にそろえて扱う

export type Source = 'shared' | 'trip' | 'personal';

export const SOURCE_LABEL: Record<Source, string> = { shared: 'ふたり', trip: '旅行', personal: '個人' };

export type Entry = {
  key: string;
  source: Source;
  store_name: string;
  amount: number;
  date: string; // YYYY-MM-DD。お金が出ていった日（旅行は支払日）
  category: string | null;
  paid_by: string | null; // 払った人のID。個人は null（自分）
  is_excluded: boolean; // おごり
  trip_name?: string;
  from_subscription?: boolean; // サブスクから自動で記録した個人の支出（固定費として数える）
};

// 自分の負担分。ふたり・旅行は割り勘なので半分、おごりは払った人の全額、個人は全額。me は自分のID
export const myShare = (e: Entry, me: string) => {
  if (e.source === 'personal') return e.amount;
  if (e.is_excluded) return e.paid_by === me ? e.amount : 0;
  return e.amount / 2;
};

type PeriodMode = 'month' | 'year' | 'range';
export type Period = { mode: PeriodMode; month: Date; year: number; from: string; to: string };

// 期間の始まりと終わり（YYYY-MM-DD）
export const periodRange = (p: Period): [string, string] => {
  if (p.mode === 'month') {
    return [toLocalYMD(new Date(p.month.getFullYear(), p.month.getMonth(), 1)), toLocalYMD(new Date(p.month.getFullYear(), p.month.getMonth() + 1, 0))];
  }
  if (p.mode === 'year') return [`${p.year}-01-01`, `${p.year}-12-31`];
  return p.from <= p.to ? [p.from, p.to] : [p.to, p.from];
};

// 推移グラフに並べる月（YYYY-MM）。月表示ならその月までの6か月、年表示なら1〜12月、期間指定ならその間の月（最大24か月）
export const trendMonths = (p: Period): string[] => {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (p.mode === 'month') {
    return Array.from({ length: 6 }, (_, i) => key(new Date(p.month.getFullYear(), p.month.getMonth() - 5 + i, 1)));
  }
  if (p.mode === 'year') return Array.from({ length: 12 }, (_, i) => `${p.year}-${String(i + 1).padStart(2, '0')}`);
  const [from, to] = periodRange(p);
  const months: string[] = [];
  const d = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 1);
  while (key(d) <= to.slice(0, 7) && months.length < 24) {
    months.push(key(d));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
};

// 期間内の支出をまとめて読む。個人の記録は自分の分だけ（me は自分のID。RLS でも相手の分は読めない）
export const loadEntries = async (from: string, to: string, me: string): Promise<Entry[]> => {
  const [shared, trips, personal] = await Promise.all([
    supabase.from('expenses').select('id, store_name, amount, purchase_date, paid_by, category, is_excluded').gte('purchase_date', from).lte('purchase_date', to),
    // 旅行は支払日（paid_on = 支払日、なければ利用日）で数える
    supabase.from('trip_expenses').select('id, store_name, amount, paid_on, paid_by, category, is_excluded, trips(name)').gte('paid_on', from).lte('paid_on', to),
    supabase.from('personal_expenses').select('id, store_name, amount, purchase_date, category, subscription_id').eq('owner', me).gte('purchase_date', from).lte('purchase_date', to),
  ]);
  for (const r of [shared, trips, personal]) if (r.error) console.error(r.error);

  return [
    ...(shared.data ?? []).map((e) => ({
      key: `shared-${e.id}`, source: 'shared' as const, store_name: e.store_name, amount: e.amount, date: e.purchase_date,
      category: e.category, paid_by: e.paid_by, is_excluded: !!e.is_excluded,
    })),
    ...(trips.data ?? []).map((e) => ({
      key: `trip-${e.id}`, source: 'trip' as const, store_name: e.store_name, amount: e.amount, date: e.paid_on,
      category: e.category, paid_by: e.paid_by, is_excluded: !!e.is_excluded,
      trip_name: (e.trips as unknown as { name: string } | null)?.name,
    })),
    ...(personal.data ?? []).map((e) => ({
      key: `personal-${e.id}`, source: 'personal' as const, store_name: e.store_name, amount: e.amount, date: e.purchase_date,
      category: e.category, paid_by: null, is_excluded: false, from_subscription: !!e.subscription_id,
    })),
  ];
};

// 期間内の収入。ふたりの収入と、自分の個人の収入（me は自分のID。RLS でも相手の個人の収入は読めない）
export const loadIncomes = async (from: string, to: string, me: string): Promise<Income[]> => {
  const { data, error } = await supabase
    .from('incomes')
    .select('*')
    .or(`is_shared.eq.true,owner.eq.${me}`)
    .gte('received_date', from)
    .lte('received_date', to);
  if (error) console.error(error);
  return data ?? [];
};

// デモモードの見本を、分析と同じ形にそろえる
export const demoEntries = (): Entry[] => [
  ...DEMO_EXPENSES.map((e) => ({ key: `shared-${e.id}`, source: 'shared' as const, store_name: e.store_name, amount: e.amount, date: e.purchase_date, category: e.category, paid_by: e.paid_by, is_excluded: e.is_excluded })),
  ...DEMO_TRIP_EXPENSES.map((e) => ({ key: `trip-${e.id}`, source: 'trip' as const, store_name: e.store_name, amount: e.amount, date: e.paid_date ?? e.purchase_date, category: e.category, paid_by: e.paid_by, is_excluded: e.is_excluded, trip_name: DEMO_TRIPS.find((t) => t.id === e.trip_id)?.name })),
  ...DEMO_PERSONAL_EXPENSES.map((e) => ({ key: `personal-${e.id}`, source: 'personal' as const, store_name: e.store_name, amount: e.amount, date: e.purchase_date, category: e.category, paid_by: null, is_excluded: false })),
];
