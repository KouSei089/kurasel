// 支出の分類。ふたり・旅行・個人・分析のすべてで、この1つの一覧を使う。
// 家計簿で一般的な「大分類 > 小分類」の2段にしている。記録には小分類の id を保存し、
// グラフや絞り込みは大分類でまとめる。
// id は DB に保存されるので、一度使った id は変えない・消さない（名前や順番、属する大分類は変えてよい）。
//
// 色（color）は大分類ごとに固定（絞り込みで並びが変わっても色は変えない）。
// 見分けやすい8色（色覚の違いでも区別できるか検証済みの並び）を、よく使う8つの大分類に順番どおり割り当て、
// 残りは null（グラフでは灰色の「そのほか」にまとめる）。並び順はこの8色の順番に合わせている
//
// short は入力欄のボタン用の短い名前（狭い iPhone でも収まるように）

export type CategoryGroup = { id: string; icon: string; label: string; color: string | null };
export type Category = { id: string; group: string; icon: string; label: string; short?: string };

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'food', icon: '🍙', label: '食費', color: '#2a78d6' },
  { id: 'daily', icon: '🧻', label: '日用品', color: '#eb6834' },
  { id: 'housing', icon: '🏠', label: '住居費', color: '#1baf7a' },
  { id: 'utilities', icon: '💡', label: '水道・光熱費', color: '#eda100' },
  { id: 'communication', icon: '📱', label: '通信費', color: '#e87ba4' },
  { id: 'transport', icon: '🚃', label: '交通費', color: '#008300' },
  { id: 'hobby', icon: '🎮', label: '趣味・娯楽', color: '#4a3aa7' },
  { id: 'fashion', icon: '👕', label: '衣服・美容', color: '#e34948' },
  { id: 'health', icon: '🏥', label: '健康・医療', color: null },
  { id: 'social', icon: '🎁', label: '交際費', color: null },
  { id: 'education', icon: '📚', label: '教育・教養', color: null },
  { id: 'insurance', icon: '🛡️', label: '保険', color: null },
  { id: 'tax', icon: '🧾', label: '税・社会保険', color: null },
  { id: 'special', icon: '💍', label: '特別な支出', color: null },
  { id: 'other', icon: '📦', label: 'その他', color: null },
];

// 以前からある id（food, eatout, daily, housing, digital, transport, hobby, lodging, fashion, learning, health, souvenir, other）は
// 意味の近い小分類としてそのまま使っている
export const CATEGORIES: Category[] = [
  { id: 'food', group: 'food', icon: '🥦', label: '食料品' },
  { id: 'eatout', group: 'food', icon: '🍽️', label: '外食' },
  { id: 'cafe', group: 'food', icon: '☕', label: 'カフェ' },
  { id: 'daily', group: 'daily', icon: '🧻', label: '日用品' },
  { id: 'drugstore', group: 'daily', icon: '🧴', label: 'ドラッグストア', short: 'ドラッグ' },
  { id: 'housing', group: 'housing', icon: '🏠', label: '家賃・住まい', short: '家賃' },
  { id: 'furniture', group: 'housing', icon: '🛋️', label: '家具・家電', short: '家具家電' },
  { id: 'electricity', group: 'utilities', icon: '💡', label: '電気' },
  { id: 'gas', group: 'utilities', icon: '🔥', label: 'ガス' },
  { id: 'water', group: 'utilities', icon: '🚰', label: '水道' },
  { id: 'phone', group: 'communication', icon: '📱', label: '携帯' },
  { id: 'internet', group: 'communication', icon: '🌐', label: 'ネット' },
  { id: 'digital', group: 'communication', icon: '💻', label: 'サブスク・アプリ', short: 'サブスク' },
  { id: 'transport', group: 'transport', icon: '🚃', label: '電車・バス', short: '電車バス' },
  { id: 'car', group: 'transport', icon: '🚗', label: '車・ガソリン', short: '車' },
  { id: 'hobby', group: 'hobby', icon: '🎮', label: '趣味' },
  { id: 'leisure', group: 'hobby', icon: '🎡', label: 'レジャー' },
  { id: 'lodging', group: 'hobby', icon: '🏨', label: '旅行・宿泊', short: '宿泊' },
  { id: 'fashion', group: 'fashion', icon: '👕', label: '服・靴' },
  { id: 'beauty', group: 'fashion', icon: '💇', label: '美容院・コスメ', short: '美容' },
  { id: 'health', group: 'health', icon: '🏥', label: '病院' },
  { id: 'medicine', group: 'health', icon: '💊', label: '薬' },
  { id: 'souvenir', group: 'social', icon: '🎁', label: '贈り物・お土産', short: '贈り物' },
  { id: 'party', group: 'social', icon: '🍻', label: '飲み会' },
  { id: 'learning', group: 'education', icon: '📚', label: '本・学び', short: '本' },
  { id: 'course', group: 'education', icon: '🎓', label: '講座・習い事', short: '講座' },
  { id: 'insurance', group: 'insurance', icon: '🛡️', label: '保険' },
  { id: 'tax', group: 'tax', icon: '🧾', label: '所得税・住民税', short: '税金' },
  { id: 'social_insurance', group: 'tax', icon: '🏛️', label: '社会保険料', short: '社会保険' },
  { id: 'ceremony', group: 'special', icon: '💐', label: '冠婚葬祭' },
  { id: 'bigpurchase', group: 'special', icon: '💎', label: '大きな買い物', short: '大きな買物' },
  { id: 'other', group: 'other', icon: '📦', label: 'その他' },
];

// 色の付かない分類をまとめるときの灰色
export const FOLDED_COLOR = '#94a3b8';

// 分類を統一する前の id。DB を移し終えるまでの間も、正しい分類として読めるようにする
const LEGACY_IDS: Record<string, string> = {
  meal: 'eatout', // 個人・旅行の「食事」
  sightseeing: 'leisure', // 旅行の「観光」
};

export const normalizeCategory = (id: string | null | undefined) => {
  const key = id ? LEGACY_IDS[id] ?? id : 'other';
  return CATEGORIES.some((c) => c.id === key) ? key : 'other';
};

export const findCategory = (id: string | null | undefined) =>
  CATEGORIES.find((c) => c.id === normalizeCategory(id))!;

export const findGroup = (groupId: string) => CATEGORY_GROUPS.find((g) => g.id === groupId)!;

// 小分類の id から大分類の id
export const groupOf = (id: string | null | undefined) => findCategory(id).group;

// 「食費 / 外食」のような表示名。大分類と同じ名前の小分類は1つだけ出す
export const categoryPath = (id: string | null | undefined) => {
  const cat = findCategory(id);
  const group = findGroup(cat.group);
  return group.label === cat.label ? cat.label : `${group.label} / ${cat.label}`;
};

// 画面ごとに、入力欄で先に出す小分類（残りは「すべて表示」で大分類ごとに出す）
export type CategoryContext = 'shared' | 'personal' | 'trip';

const PRIMARY_IDS: Record<CategoryContext, string[]> = {
  shared: ['food', 'eatout', 'daily', 'housing', 'electricity', 'phone', 'transport', 'other'],
  personal: ['eatout', 'cafe', 'fashion', 'beauty', 'hobby', 'digital', 'learning', 'transport', 'other'],
  trip: ['transport', 'lodging', 'eatout', 'leisure', 'souvenir', 'other'],
};

export const categoriesFor = (context: CategoryContext) => {
  const primary = PRIMARY_IDS[context].map((id) => CATEGORIES.find((c) => c.id === id)!);
  return { primary, isPrimary: (id: string) => PRIMARY_IDS[context].includes(id) };
};

export type CategorySum = CategoryGroup & { value: number; subs: (Category & { value: number })[] };

// 大分類別の合計（中に小分類別の内訳を持つ）。0円の分類は出さない。並びは CATEGORY_GROUPS・CATEGORIES の順
export const sumByCategory = (items: { amount: number; category: string | null }[]): CategorySum[] =>
  CATEGORY_GROUPS
    .map((group) => {
      const subs = CATEGORIES
        .filter((c) => c.group === group.id)
        .map((c) => ({ ...c, value: items.filter((e) => normalizeCategory(e.category) === c.id).reduce((sum, e) => sum + e.amount, 0) }))
        .filter((c) => c.value > 0);
      return { ...group, value: subs.reduce((sum, c) => sum + c.value, 0), subs };
    })
    .filter((g) => g.value > 0);

// AI に分類を選ばせるときの一覧（'food'(食費 / 食料品) のように並べる）
export const categoryPromptList = () =>
  CATEGORIES.map((c) => `'${c.id}'(${categoryPath(c.id)})`).join(', ');
