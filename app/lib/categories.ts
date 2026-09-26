// 支出の分類。ふたり・旅行・個人・分析のすべてで、この1つの一覧を使う。
// id は DB に保存されるので、一度使った id は変えない・消さない（名前や順番は変えてよい）。
//
// 色（color）は分類ごとに固定（絞り込みで並びが変わっても色は変えない）。
// 見分けやすい8色（色覚の違いでも区別できるか検証済みの並び）を、よく使う8分類に順番どおり割り当て、
// 残りは null（グラフでは灰色の「そのほか」にまとめる）。並び順はこの8色の順番に合わせている
//
// short は入力欄のボタン用の短い名前（狭い iPhone でも収まるように）

export type Category = { id: string; icon: string; label: string; short?: string; color: string | null };

export const CATEGORIES: Category[] = [
  { id: 'food', icon: '🥦', label: '食費', color: '#2a78d6' },
  { id: 'eatout', icon: '🍽️', label: '外食', color: '#eb6834' },
  { id: 'daily', icon: '🧻', label: '日用品', color: '#1baf7a' },
  { id: 'housing', icon: '🏠', label: '住まい・光熱', short: '住まい', color: '#eda100' },
  { id: 'digital', icon: '💻', label: '通信・デジタル', short: 'デジタル', color: '#e87ba4' },
  { id: 'transport', icon: '🚃', label: '交通', color: '#008300' },
  { id: 'hobby', icon: '🎮', label: '趣味・レジャー', short: '趣味', color: '#4a3aa7' },
  { id: 'lodging', icon: '🏨', label: '宿泊', color: '#e34948' },
  { id: 'fashion', icon: '👕', label: '服・美容', color: null },
  { id: 'learning', icon: '📚', label: '学び・仕事', short: '学び', color: null },
  { id: 'health', icon: '💊', label: '医療・健康', short: '医療', color: null },
  { id: 'souvenir', icon: '🎁', label: 'お土産・贈り物', short: 'お土産', color: null },
  { id: 'other', icon: '📦', label: 'その他', color: null },
];

// 色の付かない分類をまとめるときの灰色
export const FOLDED_COLOR = '#94a3b8';

// 分類を統一する前の id。DB を移し終えるまでの間も、正しい分類として読めるようにする
const LEGACY_IDS: Record<string, string> = {
  meal: 'eatout', // 個人・旅行の「食事」
  sightseeing: 'hobby', // 旅行の「観光」
};

export const normalizeCategory = (id: string | null | undefined) => {
  const key = id ? LEGACY_IDS[id] ?? id : 'other';
  return CATEGORIES.some((c) => c.id === key) ? key : 'other';
};

export const findCategory = (id: string | null | undefined) =>
  CATEGORIES.find((c) => c.id === normalizeCategory(id))!;

// 画面ごとに、入力欄で先に出す分類（残りは「すべて表示」で出す）
export type CategoryContext = 'shared' | 'personal' | 'trip';

const PRIMARY_IDS: Record<CategoryContext, string[]> = {
  shared: ['food', 'eatout', 'daily', 'housing', 'digital', 'transport', 'health', 'other'],
  personal: ['eatout', 'daily', 'fashion', 'hobby', 'digital', 'learning', 'transport', 'health', 'other'],
  trip: ['transport', 'lodging', 'eatout', 'hobby', 'souvenir', 'other'],
};

export const categoriesFor = (context: CategoryContext) => {
  const primary = PRIMARY_IDS[context].map((id) => CATEGORIES.find((c) => c.id === id)!);
  const rest = CATEGORIES.filter((c) => !PRIMARY_IDS[context].includes(c.id));
  return { primary, rest };
};

// 分類別の合計。0円の分類は出さない。並びは CATEGORIES の順
export const sumByCategory = (items: { amount: number; category: string | null }[]) =>
  CATEGORIES
    .map((cat) => ({
      ...cat,
      value: items.filter((e) => normalizeCategory(e.category) === cat.id).reduce((sum, e) => sum + e.amount, 0),
    }))
    .filter((c) => c.value > 0);
