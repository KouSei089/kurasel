'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Plus, Users } from 'lucide-react';
import { Card, EmptyState, buttonClass } from '../components/ui';
import { groupOf } from '../lib/categories';
import { Entry, myShare } from '../lib/analytics';
import { INCOME_CATEGORIES, findIncomeCategory, myIncomeShare, type Income } from '../lib/income';
import { CHART_COLORS, MonthChart } from './MonthChart';

// 収入の分析。自分の収入（全額）と、ふたりの収入（半分）を合わせた「自分の分」で見る。
// 給与・賞与は、天引きされた税金・社会保険料を引いた手取りも出す

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
const formatYMD = (ymd: string) => ymd.replaceAll('-', '/');

export function IncomeView({ entries, incomes, from, to, months, focusMonth, onFocusMonth, periodLabel, myUserId, nameOf }: {
  entries: Entry[];
  incomes: Income[];
  from: string;
  to: string;
  months: string[];
  focusMonth: string;
  onFocusMonth: (m: string) => void;
  periodLabel: string;
  myUserId: string;
  nameOf: (id: string) => string;
}) {
  const [visibleCount, setVisibleCount] = useState(20);

  const inPeriod = incomes.filter((i) => i.received_date >= from && i.received_date <= to).sort((a, b) => b.received_date.localeCompare(a.received_date));
  const total = inPeriod.reduce((sum, i) => sum + myIncomeShare(i), 0);
  const personal = inPeriod.filter((i) => !i.is_shared).reduce((sum, i) => sum + i.amount, 0);
  const shared = inPeriod.filter((i) => i.is_shared).reduce((sum, i) => sum + i.amount, 0);

  // 給与・賞与の手取り（総支給 − 天引きの税金・社会保険料）
  const pay = inPeriod.filter((i) => !i.is_shared && (i.category === 'salary' || i.category === 'bonus')).reduce((sum, i) => sum + i.amount, 0);
  const deductions = entries.filter((e) => e.source === 'personal' && e.date >= from && e.date <= to && groupOf(e.category) === 'tax').reduce((sum, e) => sum + myShare(e, myUserId), 0);

  const byCategory = INCOME_CATEGORIES
    .map((c) => ({ ...c, value: inPeriod.filter((i) => findIncomeCategory(i.category).id === c.id).reduce((sum, i) => sum + myIncomeShare(i), 0) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const monthly = months.map((m) => incomes.filter((i) => i.received_date.startsWith(m)).reduce((sum, i) => sum + myIncomeShare(i), 0));
  const focusIndex = months.indexOf(focusMonth);

  if (inPeriod.length === 0 && monthly.every((v) => v === 0)) {
    return (
      <>
        <EmptyState icon="💴" title={`${periodLabel}の収入の記録はありません`} description="給料や給付金などを記録すると、ここで収入と手取りを見られます" />
        <Link href="/income" className={`${buttonClass.primary} w-full py-3.5 mt-4 text-sm`}><Plus size={16} /> 収入を記録する</Link>
      </>
    );
  }

  return (
    <>
      {/* 期間の収入 */}
      <Card className="p-6 mb-4">
        <p className="text-xs font-bold text-slate-400 mb-1">{periodLabel}の収入<span className="ml-1.5 text-[10px]">自分の分</span></p>
        <p className="text-4xl font-black tracking-tight leading-tight text-slate-800">{yen(total)}</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-500">自分の収入</p>
            <p className="text-lg font-black text-slate-800 tabular">{yen(personal)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] font-bold text-slate-500"><Users size={11} />ふたりの収入</p>
            <p className="text-lg font-black text-slate-800 tabular">{yen(shared)}</p>
            {shared > 0 && <p className="text-[10px] font-bold text-slate-400">自分の分 {yen(shared / 2)}</p>}
          </div>
        </div>
      </Card>
      <p className="text-[10px] text-slate-400 mb-6 ml-1">ふたりの収入は半分を自分の分として計算しています</p>

      {/* 給与・賞与の手取り */}
      {pay > 0 && (
        <Card className="p-5 mb-6">
          <h3 className="font-black text-sm text-slate-800 mb-3">給与・賞与の手取り</h3>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between"><dt className="font-bold text-slate-500">総支給</dt><dd className="font-bold text-slate-700 tabular">{yen(pay)}</dd></div>
            <div className="flex justify-between"><dt className="font-bold text-slate-500">税・社会保険（天引き）</dt><dd className="font-bold text-slate-700 tabular">−{yen(deductions)}</dd></div>
            <div className="flex justify-between pt-1.5 border-t border-slate-100"><dt className="font-black text-slate-800">手取り</dt><dd className="font-black text-slate-800 tabular">{yen(pay - deductions)}</dd></div>
          </dl>
          {deductions > 0
            ? <p className="text-[10px] text-slate-400 mt-2">総支給のうち {Math.round((deductions / pay) * 100)}% が税金・社会保険料です</p>
            : <p className="text-[10px] text-slate-400 mt-2"><Link href="/income/payslip" className="font-bold text-slate-600 underline underline-offset-2">給与明細を取り込む</Link>と、天引きの税金・社会保険料も入ります</p>}
        </Card>
      )}

      {/* 分類別 */}
      {byCategory.length > 0 && (
        <Card className="p-5 mb-6">
          <h3 className="font-black text-sm text-slate-800 mb-3">分類別</h3>
          <ul className="space-y-2.5">
            {byCategory.map((c) => (
              <li key={c.id} className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-500">{c.icon} {c.label}</span>
                  <span className="font-bold text-slate-700 tabular">{yen(c.value)}<span className="ml-2 text-slate-400 font-normal">{Math.round((c.value / total) * 100)}%</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(c.value / total) * 100}%`, backgroundColor: CHART_COLORS.income }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 月ごとの収入 */}
      <Card className="p-5 mb-6">
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <h3 className="font-black text-sm text-slate-800">月ごとの収入</h3>
          {focusIndex >= 0 && <span className="text-xs font-bold text-slate-500 tabular">{Number(focusMonth.slice(5))}月 <span className="text-slate-800 font-black">{yen(monthly[focusIndex])}</span></span>}
        </div>
        <MonthChart months={months} series={[{ key: 'income', label: '収入', color: CHART_COLORS.income, values: monthly }]} focusMonth={focusMonth} onFocus={onFocusMonth} label="月ごとの収入" />
      </Card>

      {/* 明細 */}
      <div className="flex items-baseline justify-between mb-3 ml-1">
        <h3 className="font-black text-slate-800 flex items-baseline gap-2 whitespace-nowrap">明細<span className="text-xs font-bold text-slate-400">{inPeriod.length}件</span></h3>
        <Link href="/income" className="text-[11px] font-bold text-slate-500 hover:text-slate-700">収入を記録</Link>
      </div>
      <ul className="space-y-2">
        {inPeriod.slice(0, visibleCount).map((i) => {
          const cat = findIncomeCategory(i.category);
          return (
            <li key={i.id}>
              <Card className="p-3 flex items-center gap-2.5">
                <span className="text-lg w-9 h-9 shrink-0 flex items-center justify-center bg-slate-100 rounded-xl">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 truncate">{i.source || cat.label}</p>
                  <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 min-w-0">
                    <span className="tabular shrink-0">{formatYMD(i.received_date)}</span>
                    <span className="truncate">・{cat.label}</span>
                    {i.is_shared && <span className="shrink-0">・ふたり（{nameOf(i.owner)}が記録）</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-slate-800 tabular">+{yen(i.amount)}</p>
                  {i.is_shared && <p className="text-[10px] font-bold text-slate-400 tabular">自分の分 {yen(i.amount / 2)}</p>}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {inPeriod.length > visibleCount && (
        <button onClick={() => setVisibleCount((c) => c + 20)} className={`${buttonClass.secondary} w-full py-3 mt-4 text-xs`}>もっと見る <ChevronDown size={14} /></button>
      )}
    </>
  );
}
