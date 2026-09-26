// 日常の支出カテゴリ。入力・編集・精算・グラフで同じ定義を使う。
// bar はカテゴリ別集計の棒の色（Tailwind が拾えるようクラス名をそのまま書く）

export type Category = { id: string; icon: string; label: string; bar: string };

export const DAILY_CATEGORIES: Category[] = [
  { id: 'food', icon: '🥦', label: '食費', bar: 'bg-emerald-400' },
  { id: 'daily', icon: '🧻', label: '日用品', bar: 'bg-amber-400' },
  { id: 'eatout', icon: '🍻', label: '外食', bar: 'bg-rose-400' },
  { id: 'transport', icon: '🚃', label: '交通', bar: 'bg-sky-400' },
  { id: 'other', icon: '📦', label: 'その他', bar: 'bg-slate-400' },
];

export const findCategory = (categories: Category[], id: string | null) =>
  categories.find((c) => c.id === id) ?? categories[categories.length - 1];

// カテゴリ別の合計。0円のカテゴリは出さない
export const sumByCategory = (categories: Category[], items: { amount: number; category: string | null }[]) =>
  categories
    .map((cat) => ({
      ...cat,
      value: items.filter((e) => findCategory(categories, e.category).id === cat.id).reduce((sum, e) => sum + e.amount, 0),
    }))
    .filter((c) => c.value > 0);
