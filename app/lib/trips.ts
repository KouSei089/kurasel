// 旅行機能で共通の型と定義。
// 日常の支出(expenses)とはテーブルもカテゴリも分けている。

export type Trip = {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_paid: boolean;
  is_received: boolean;
  budget: number | null; // 予算（目標利用金額）。未設定なら null
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
  is_settled: boolean; // 途中精算で精算済みにした記録
  created_at: string;
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

// 予算の消化具合。使った額は、おごり・精算済みも含めた旅行中の支出すべてで数える
// （精算とは違い「旅行でいくら使ったか」を見るため）
export const budgetStatus = (budget: number, spent: number) => {
  const ratio = budget > 0 ? spent / budget : 0;
  return {
    ratio,
    remaining: budget - spent,
    level: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok',
  } as const;
};

// 残りの日数（今日を含む）。旅行が終わっている・日程がない場合は null
export const remainingDays = (trip: Pick<Trip, 'start_date' | 'end_date'>, today: string) => {
  if (!trip.start_date) return null;
  const end = trip.end_date || trip.start_date;
  if (today > end) return null;
  const from = today < trip.start_date ? trip.start_date : today;
  const days = Math.round((Date.parse(end) - Date.parse(from)) / 86400000) + 1;
  return days > 0 ? days : null;
};
