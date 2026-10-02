'use client';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, CalendarCheck, ChevronRight, Plus } from 'lucide-react';
import { Card } from '../components/ui';
import { groupOf } from '../lib/categories';
import { Entry, myShare } from '../lib/analytics';
import { myIncomeShare, type Income } from '../lib/income';
import { CHART_COLORS, MonthChart } from './MonthChart';
import { FixedCostCard } from './FixedCostCard';

// 収支（自分の分）。収入から支出を引いて、いくら残ったか（貯金できた額）を見る。
// 相手の個人の収入・支出は見えないので、ふたりの分は半分ずつにした「自分の分」で比べる

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
const signedYen = (n: number) => `${n >= 0 ? '+' : '−'}${yen(Math.abs(n))}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function BalanceView({ entries, incomes, from, to, months, focusMonth, onFocusMonth, periodLabel, isMonthMode, myUserId }: {
  entries: Entry[]; // 推移グラフの分も含めた支出
  incomes: Income[]; // 推移グラフの分も含めた収入
  from: string;
  to: string;
  months: string[];
  focusMonth: string;
  onFocusMonth: (m: string) => void;
  periodLabel: string;
  isMonthMode: boolean;
  myUserId: string;
}) {
  const incomeIn = (a: string, b: string) => incomes.filter((i) => i.received_date >= a && i.received_date <= b).reduce((sum, i) => sum + myIncomeShare(i), 0);
  const expenseIn = (a: string, b: string, only?: (e: Entry) => boolean) =>
    entries.filter((e) => e.date >= a && e.date <= b && (!only || only(e))).reduce((sum, e) => sum + myShare(e, myUserId), 0);
  const isTax = (e: Entry) => groupOf(e.category) === 'tax';

  const income = incomeIn(from, to);
  const expense = expenseIn(from, to);
  const tax = expenseIn(from, to, isTax);
  const balance = income - expense;
  const savingRate = income > 0 ? balance / income : null;

  // 月ごと
  const monthEnd = (m: string) => `${m}-31`;
  const monthly = months.map((m) => {
    const i = incomeIn(`${m}-01`, monthEnd(m));
    const e = expenseIn(`${m}-01`, monthEnd(m));
    return { month: m, income: i, expense: e, balance: i - e };
  });
  const focus = monthly.find((m) => m.month === focusMonth);

  // 月で見ているときは、先月との差
  const prev = isMonthMode && monthly.length >= 2 ? monthly[monthly.length - 2] : null;
  const diff = prev ? balance - prev.balance : null;

  // 収入の使いみち: 税・社会保険 / それ以外の支出 / 残った額
  const spending = Math.max(expense - tax, 0);
  const remaining = income - expense;
  const segments = income > 0 ? [
    { key: 'tax', label: '税・社会保険', value: tax, color: CHART_COLORS.tax },
    { key: 'spending', label: '生活の支出', value: Math.min(spending, Math.max(income - tax, 0)), color: CHART_COLORS.expense },
    { key: 'remaining', label: '残った額', value: Math.max(remaining, 0), color: CHART_COLORS.income },
  ].filter((s) => s.value > 0) : [];

  return (
    <>
      {/* 期間の収支 */}
      <Card className="p-6 mb-4">
        <p className="text-xs font-bold text-slate-400 mb-1">{periodLabel}の収支<span className="ml-1.5 text-[10px]">自分の分</span></p>
        <p className={`text-4xl font-black tracking-tight leading-tight ${balance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
          {signedYen(balance)}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] font-bold text-slate-500">
          {savingRate !== null && <span>貯蓄率 <span className="text-slate-800">{pct(savingRate)}</span></span>}
          {diff !== null && prev && (prev.income > 0 || prev.expense > 0) && (
            <span className={`inline-flex items-center gap-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {diff >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}先月より {signedYen(diff)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className="w-2 h-2 rounded-[3px]" style={{ backgroundColor: CHART_COLORS.income }} />収入</p>
            <p className="text-lg font-black text-slate-800 tabular">{yen(income)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className="w-2 h-2 rounded-[3px]" style={{ backgroundColor: CHART_COLORS.expense }} />支出</p>
            <p className="text-lg font-black text-slate-800 tabular">{yen(expense)}</p>
          </div>
        </div>

        {income === 0 && (
          <Link href="/income" className="mt-3 flex items-center justify-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl py-2.5">
            <Plus size={14} /> 収入を記録すると、貯金できた額がわかります
          </Link>
        )}
      </Card>
      <p className="text-[10px] text-slate-400 mb-4 ml-1 leading-relaxed">ふたりの収入・支出は半分、おごりは払った人、個人は全額で計算しています</p>

      <Link href={isMonthMode ? `/review?month=${months[months.length - 1]}` : '/review'} className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/70 border border-white shadow-sm hover:bg-white transition-colors">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700"><CalendarCheck size={16} className="text-amber-500" />{isMonthMode ? `${Number(months[months.length - 1].slice(5))}月の振り返りを見る` : '月の振り返りを見る'}</span>
        <ChevronRight size={16} className="text-slate-300 shrink-0" />
      </Link>

      {/* 収入の使いみち */}
      {segments.length > 0 && (
        <Card className="p-5 mb-6">
          <h3 className="font-black text-sm text-slate-800 mb-3">収入の使いみち</h3>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 gap-0.5 mb-3" role="img" aria-label="収入の使いみちの割合">
            {segments.map((s) => (
              <span key={s.key} title={`${s.label} ${yen(s.value)}（${pct(s.value / income)}）`} style={{ width: `${(s.value / income) * 100}%`, backgroundColor: s.color }} />
            ))}
          </div>
          <ul className="space-y-1.5">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-3 text-xs">
                <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 font-bold text-slate-500">{s.label}</span>
                <span className="text-slate-400 tabular">{pct(s.value / income)}</span>
                <span className="w-20 text-right font-bold text-slate-700 tabular">{yen(s.value)}</span>
              </li>
            ))}
          </ul>
          {remaining < 0 && <p className="text-[10px] font-bold text-rose-500 mt-2">収入より {yen(-remaining)} 多く使っています</p>}
          {tax === 0 && <p className="text-[10px] text-slate-400 mt-2">給与明細を取り込むと、税金・社会保険料も入ります</p>}
        </Card>
      )}

      <FixedCostCard entries={entries.filter((e) => e.date >= from && e.date <= to)} myUserId={myUserId} monthCount={months.filter((m) => `${m}-01` >= from.slice(0, 8) + '01' && `${m}-01` <= to).length} />

      {/* 月ごとの収入と支出 */}
      <Card className="p-5 mb-6">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h3 className="font-black text-sm text-slate-800">月ごとの収入と支出</h3>
        </div>
        {focus && (
          <p className="text-[11px] font-bold text-slate-500 tabular mb-3">
            {Number(focus.month.slice(5))}月 収入 <span className="text-slate-800">{yen(focus.income)}</span>
            {' ・ '}支出 <span className="text-slate-800">{yen(focus.expense)}</span>
            {' ・ '}<span className={focus.balance >= 0 ? 'text-emerald-600' : 'text-rose-500'}>{signedYen(focus.balance)}</span>
          </p>
        )}
        <MonthChart
          months={months}
          series={[
            { key: 'income', label: '収入', color: CHART_COLORS.income, values: monthly.map((m) => m.income) },
            { key: 'expense', label: '支出', color: CHART_COLORS.expense, values: monthly.map((m) => m.expense) },
          ]}
          focusMonth={focusMonth}
          onFocus={onFocusMonth}
          label="月ごとの収入と支出"
        />
      </Card>
    </>
  );
}
