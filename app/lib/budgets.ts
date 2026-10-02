import { supabase } from './supabase';
import { CATEGORY_GROUPS, groupOf } from './categories';
import { budgetStatus } from './trips';

// 月の予算。大分類ごと（または全体）に、毎月同じ額を決める。
// ふたりの予算は日常のふたりの支出（おごりは除く。精算画面の「カテゴリ別」と同じ）と、自分の予算は個人の支出と比べる

export type BudgetScope = 'shared' | 'personal';

export type Budget = {
  id: number;
  owner: string;
  is_shared: boolean;
  category_group: string; // 大分類の id、または TOTAL
  amount: number;
};

export const TOTAL = 'total';

export const BUDGET_TARGETS = [
  { id: TOTAL, icon: '💰', label: '全体' },
  ...CATEGORY_GROUPS.map((g) => ({ id: g.id, icon: g.icon, label: g.label })),
];

export const findBudgetTarget = (id: string) => BUDGET_TARGETS.find((t) => t.id === id) ?? BUDGET_TARGETS[0];

export const loadBudgets = async (scope: BudgetScope, me: string): Promise<Budget[]> => {
  let query = supabase.from('budgets').select('id, owner, is_shared, category_group, amount').eq('is_shared', scope === 'shared');
  if (scope === 'personal') query = query.eq('owner', me);
  const { data, error } = await query;
  if (error) console.error(error);
  return data ?? [];
};

export type BudgetProgressRow = {
  id: string;
  icon: string;
  label: string;
  budget: number;
  spent: number;
} & ReturnType<typeof budgetStatus>;

// 予算ごとの使った額と消化率。全体を先頭に、あとは大分類の並び順
export const budgetProgress = (budgets: Pick<Budget, 'category_group' | 'amount'>[], items: { amount: number; category: string | null }[]): BudgetProgressRow[] =>
  BUDGET_TARGETS.flatMap((t) => {
    const b = budgets.find((x) => x.category_group === t.id);
    if (!b) return [];
    const spent = items.filter((i) => t.id === TOTAL || groupOf(i.category) === t.id).reduce((sum, i) => sum + i.amount, 0);
    return [{ id: t.id, icon: t.icon, label: t.label, budget: b.amount, spent, ...budgetStatus(b.amount, spent) }];
  });
