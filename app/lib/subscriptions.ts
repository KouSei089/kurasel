import { supabase } from './supabase';
import { toLocalYMD, todayYMD } from './date';

// 個人のサブスク。支払日が来たら personal_expenses へ自動で記録する。
// サーバー側の定期実行は使わず、アプリ（個人タブ）を開いたときに、たまっている支払日の分をまとめて記録する

export type Cycle = 'monthly' | 'yearly';

export type Subscription = {
  id: number;
  owner: string;
  name: string;
  amount: number;
  cycle: Cycle;
  billing_day: number; // 最初の支払日の「日」。月末払いのずれを戻すために使う
  next_billing_date: string; // YYYY-MM-DD
  category: string | null;
  is_active: boolean;
  created_at: string;
};

export const CYCLE_LABEL: Record<Cycle, string> = { monthly: '毎月', yearly: '毎年' };

// 年払いは12で割って月あたりに揃える（合計や割合を比べるため）
export const monthlyAmount = (s: Pick<Subscription, 'amount' | 'cycle'>) => (s.cycle === 'yearly' ? s.amount / 12 : s.amount);

// 次の支払日。31日払いなら 1/31 → 2/28(29) → 3/31 のように、その月に無い日は月末にして、翌月は元の日に戻す
export const nextBillingDate = (current: string, cycle: Cycle, billingDay: number) => {
  const [y, m] = current.split('-').map(Number);
  const target = cycle === 'yearly' ? new Date(y + 1, m - 1, 1) : new Date(y, m, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(billingDay, lastDay));
  return toLocalYMD(target);
};

export const daysUntil = (ymd: string, today = todayYMD()) =>
  Math.round((Date.parse(ymd) - Date.parse(today)) / 86400000);

export const subscriptionRecordName = (name: string) => `${name}（サブスク）`;

// 支払日を過ぎた利用中のサブスクを、個人の支出に記録して次の支払日へ進める。記録した件数を返す
export const syncSubscriptions = async (owner: string) => {
  const today = todayYMD();
  const { data: due, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('owner', owner)
    .eq('is_active', true)
    .lte('next_billing_date', today);
  if (error) { console.error(error); return 0; }
  if (!due || due.length === 0) return 0;

  let recorded = 0;
  for (const sub of due as Subscription[]) {
    // 長く開いていなかった分もまとめて記録する（念のため最大36回＝3年分まで）
    const dates: string[] = [];
    let date = sub.next_billing_date;
    while (date <= today && dates.length < 36) {
      dates.push(date);
      date = nextBillingDate(date, sub.cycle, sub.billing_day);
    }

    const rows = dates.map((d) => ({
      owner,
      store_name: subscriptionRecordName(sub.name),
      amount: sub.amount,
      purchase_date: d,
      category: sub.category,
      subscription_id: sub.id,
    }));
    // 同じ支払日の記録がすでにあると一意制約で弾かれる（別の端末が先に記録した場合など）。
    // まとめて入れて弾かれたら、1件ずつ入れて既にあるものだけ飛ばす
    const { error: insertError } = await supabase.from('personal_expenses').insert(rows);
    if (insertError) {
      if (insertError.code !== '23505') { console.error(insertError); continue; }
      for (const row of rows) {
        const { error: rowError } = await supabase.from('personal_expenses').insert(row);
        if (!rowError) recorded += 1;
        else if (rowError.code !== '23505') console.error(rowError);
      }
    } else {
      recorded += rows.length;
    }

    const { error: updateError } = await supabase.from('subscriptions').update({ next_billing_date: date }).eq('id', sub.id);
    if (updateError) console.error(updateError);
  }
  return recorded;
};
