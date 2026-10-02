// 収入。個人の収入（本人だけが見られる）と、ふたりの収入（世帯のふたりが見られる）を
// 同じテーブル（incomes）で持ち、is_shared で分ける。精算には使わず、分析の収支で使う

export type Income = {
  id: number;
  owner: string; // 記録した人のID
  is_shared: boolean;
  source: string | null;
  amount: number;
  received_date: string; // YYYY-MM-DD
  category: string | null;
  created_at: string;
};

export type IncomeScope = 'shared' | 'personal';

// id は DB に保存されるので、一度使った id は変えない・消さない
export const INCOME_CATEGORIES = [
  { id: 'salary', icon: '💴', label: '給与' },
  { id: 'bonus', icon: '🎉', label: '賞与' },
  { id: 'side', icon: '💼', label: '副業' },
  { id: 'benefit', icon: '🏛️', label: '給付金・手当', short: '給付金' },
  { id: 'gift', icon: '💝', label: 'お祝い・贈与', short: 'お祝い' },
  { id: 'refund', icon: '↩️', label: '還付・払い戻し', short: '還付' },
  { id: 'investment', icon: '📈', label: '配当・利息', short: '配当' },
  { id: 'other_income', icon: '💰', label: 'その他' },
] as const;

export const findIncomeCategory = (id: string | null | undefined) =>
  INCOME_CATEGORIES.find((c) => c.id === id) ?? INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1];

// 自分の分の収入。ふたりの収入は半分ずつ、個人の収入は全額（自分の分だけ読めるので、相手の個人の収入は来ない）
export const myIncomeShare = (i: Pick<Income, 'amount' | 'is_shared'>) => (i.is_shared ? i.amount / 2 : i.amount);
