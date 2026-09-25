// 旅行機能で共通の型と定義。
// 日常の支出(expenses)とはテーブルもカテゴリも分けている。

export type Trip = {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_paid: boolean;
  is_received: boolean;
  created_at: string;
};

export type TripExpense = {
  id: number;
  trip_id: number;
  store_name: string;
  amount: number;
  purchase_date: string;
  paid_by: string;
  category: string | null;
  receipt_url: string | null;
  is_excluded: boolean; // おごり等で割り勘の対象外
  created_at: string;
};

export const TRIP_CATEGORIES = [
  { id: 'transport', icon: '🚄', label: '交通' },
  { id: 'lodging', icon: '🏨', label: '宿泊' },
  { id: 'meal', icon: '🍽️', label: '食事' },
  { id: 'sightseeing', icon: '🎡', label: '観光' },
  { id: 'souvenir', icon: '🎁', label: 'お土産' },
  { id: 'other', icon: '📦', label: 'その他' },
];

export const getTripCategory = (id: string | null) =>
  TRIP_CATEGORIES.find((c) => c.id === id) ?? TRIP_CATEGORIES[TRIP_CATEGORIES.length - 1];

// レシート解析は日常用のカテゴリで返ってくるので、旅行用に読み替える
export const toTripCategory = (dailyCategory?: string) => {
  switch (dailyCategory) {
    case 'transport': return 'transport';
    case 'food': case 'eatout': return 'meal';
    default: return 'other';
  }
};

const formatYMD = (ymd: string) => {
  const [y, m, d] = ymd.split('-');
  return `${y}/${m}/${d}`;
};

export const formatTripPeriod = (trip: Pick<Trip, 'start_date' | 'end_date'>) => {
  if (!trip.start_date) return '日程未設定';
  if (!trip.end_date || trip.end_date === trip.start_date) return formatYMD(trip.start_date);
  // 同じ年なら終了日の年は省く
  const end = trip.end_date.slice(0, 4) === trip.start_date.slice(0, 4)
    ? formatYMD(trip.end_date).slice(5)
    : formatYMD(trip.end_date);
  return `${formatYMD(trip.start_date)} 〜 ${end}`;
};
