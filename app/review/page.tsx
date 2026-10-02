'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Lightbulb, Target } from 'lucide-react';
import { PageShell, PageHeader, Card, Loading } from '../components/ui';
import { CATEGORY_GROUPS, groupOf } from '../lib/categories';
import { Entry, demoEntries, loadEntries, loadIncomes, myShare } from '../lib/analytics';
import { myIncomeShare, type Income } from '../lib/income';
import { budgetProgress, loadBudgets, type Budget } from '../lib/budgets';
import { DEMO_BUDGETS, DEMO_INCOMES } from '../lib/demoData';
import { FixedCostCard, splitFixedCosts } from '../analytics/FixedCostCard';
import { CHART_COLORS } from '../analytics/MonthChart';
import { useCurrentUser } from '../lib/useCurrentUser';
import { toLocalYMD } from '../lib/date';

// 毎月の振り返り。?month=YYYY-MM の月（なければ先月）を、前の月と比べて1枚にまとめる。
// 収支・ふたりで使ったお金・増えた/減った分類・予算の結果・固定費と変動費・大きな支出。
// 数字は見る人ごと（自分の分）。ふたりとも開けるので、話し合いのきっかけに使う
// useSearchParams を使う部分は Suspense で包む必要がある（Next.js の静的生成のため）
export default function ReviewPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50"></div>}>
      <ReviewPage />
    </Suspense>
  );
}

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
const signedYen = (n: number) => `${n >= 0 ? '+' : '−'}${yen(Math.abs(n))}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const shiftMonth = (key: string, diff: number) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + diff, 1)); };
const monthRange = (key: string): [string, string] => { const [y, m] = key.split('-').map(Number); return [toLocalYMD(new Date(y, m - 1, 1)), toLocalYMD(new Date(y, m, 0))]; };
const monthName = (key: string) => `${Number(key.slice(5))}月`;

function ReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDemoMode, myUserId, myUserName } = useCurrentUser();

  // 見る月。指定がなければ先月（デモは見本のある 2024年2月）
  const requested = searchParams.get('month');
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : isDemoMode ? '2024-02' : shiftMonth(monthKey(new Date()), -1);
  const prevMonth = shiftMonth(month, -1);
  const isLatest = month >= shiftMonth(monthKey(new Date()), -1) && !isDemoMode;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loadedKey, setLoadedKey] = useState('');

  const [from] = monthRange(prevMonth);
  const [monthFrom, to] = monthRange(month);

  useEffect(() => {
    if (!myUserId || isDemoMode) return;
    let cancelled = false;
    Promise.all([loadEntries(from, to, myUserId), loadIncomes(from, to, myUserId), loadBudgets('shared', myUserId), loadBudgets('personal', myUserId)])
      .then(([e, i, sharedBudgets, personalBudgets]) => {
        if (cancelled) return;
        setEntries(e);
        setIncomes(i);
        setBudgets([...sharedBudgets, ...personalBudgets]);
        setLoadedKey(month);
      });
    return () => { cancelled = true; };
  }, [myUserId, isDemoMode, from, to, month]);

  const allEntries = isDemoMode ? demoEntries() : entries;
  const allIncomes = isDemoMode ? DEMO_INCOMES : incomes;
  const allBudgets = isDemoMode ? DEMO_BUDGETS : budgets;
  const isLoading = !isDemoMode && loadedKey !== month;

  const inMonth = (key: string) => allEntries.filter((e) => e.date.startsWith(key));
  const cur = inMonth(month);
  const prev = inMonth(prevMonth);
  const incomeOf = (key: string) => allIncomes.filter((i) => i.received_date.startsWith(key)).reduce((sum, i) => sum + myIncomeShare(i), 0);
  const expenseOf = (list: Entry[]) => list.reduce((sum, e) => sum + myShare(e, myUserId), 0);

  const income = incomeOf(month);
  const expense = expenseOf(cur);
  const balance = income - expense;
  const prevBalance = incomeOf(prevMonth) - expenseOf(prev);
  const hasPrev = prev.length > 0 || incomeOf(prevMonth) > 0;

  // ふたりで使ったお金（総額）
  const sharedTotal = (list: Entry[]) => list.filter((e) => e.source === 'shared').reduce((sum, e) => sum + e.amount, 0);
  const tripTotal = (list: Entry[]) => list.filter((e) => e.source === 'trip').reduce((sum, e) => sum + e.amount, 0);

  // 大分類ごとの増減（自分の分）
  const byGroup = (list: Entry[], id: string) => list.filter((e) => groupOf(e.category) === id).reduce((sum, e) => sum + myShare(e, myUserId), 0);
  const changes = CATEGORY_GROUPS
    .map((g) => ({ ...g, now: byGroup(cur, g.id), before: byGroup(prev, g.id) }))
    .map((g) => ({ ...g, diff: g.now - g.before }))
    .filter((g) => g.diff !== 0);
  const increased = changes.filter((g) => g.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3);
  const decreased = changes.filter((g) => g.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 3);

  // 予算の結果
  const sharedRows = budgetProgress(allBudgets.filter((b) => b.is_shared), cur.filter((e) => e.source === 'shared' && !e.is_excluded));
  const personalRows = budgetProgress(allBudgets.filter((b) => !b.is_shared), cur.filter((e) => e.source === 'personal'));
  const budgetRows = [...sharedRows.map((r) => ({ ...r, scope: 'ふたり' })), ...personalRows.map((r) => ({ ...r, scope: '自分' }))];

  // 大きな支出（総額の大きい順）。給与から天引きされる税・社会保険は毎月のことなので除く
  const biggest = cur.filter((e) => groupOf(e.category) !== 'tax').sort((a, b) => b.amount - a.amount).slice(0, 3);

  // ふりかえりのポイント（数字から自動で）
  const { fixed } = splitFixedCosts(cur, myUserId);
  const points: string[] = [];
  if (income > 0) points.push(balance >= 0 ? `収入の ${Math.round((balance / income) * 100)}% を残せました` : `収入より ${yen(-balance)} 多く使いました`);
  if (hasPrev && balance !== prevBalance) points.push(`先月より残ったお金が ${signedYen(balance - prevBalance)}`);
  if (hasPrev && increased[0]) points.push(`${increased[0].label}が先月より ${yen(increased[0].diff)} 増えました`);
  if (hasPrev && decreased[0]) points.push(`${decreased[0].label}は先月より ${yen(-decreased[0].diff)} 減りました`);
  const over = budgetRows.filter((r) => r.level === 'over');
  if (over.length > 0) points.push(`予算を超えたのは ${over.map((r) => `${r.scope}の${r.label}`).join('・')}`);
  else if (budgetRows.length > 0) points.push('すべての予算内に収まりました');
  if (expense > 0 && fixed > 0) points.push(`支出のうち固定費は ${Math.round((fixed / expense) * 100)}%（${yen(fixed)}）`);

  const go = (key: string) => router.replace(`/review?month=${key}`);

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <PageShell isDemoMode={isDemoMode}>
      <PageHeader title={`${monthName(month)}の振り返り`} subtitle="前の月と比べて、お金の動きを1枚にまとめました" isDemoMode={isDemoMode} back={{ href: '/analytics', label: '分析' }} />

      <Card className="flex items-center justify-between p-1.5 mb-6">
        <button onClick={() => go(prevMonth)} className="p-3 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition" aria-label="前の月"><ChevronLeft size={20} /></button>
        <span className="font-black text-lg text-slate-800 tabular">{month.slice(0, 4)}年{monthName(month)}</span>
        <button onClick={() => go(shiftMonth(month, 1))} disabled={isLatest} className="p-3 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-30" aria-label="次の月"><ChevronRight size={20} /></button>
      </Card>

      {isLoading ? <Loading /> : cur.length === 0 && income === 0 ? (
        <Card className="text-center py-12 px-6"><p className="text-4xl mb-3">🗓️</p><p className="text-sm font-bold text-slate-500">{monthName(month)}の記録はありません</p></Card>
      ) : (
        <>
          {/* 収支 */}
          <Card className="p-6 mb-4">
            <p className="text-xs font-bold text-slate-400 mb-1">{monthName(month)}の収支<span className="ml-1.5 text-[10px]">自分の分</span></p>
            <p className={`text-4xl font-black tracking-tight leading-tight ${balance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{signedYen(balance)}</p>
            {hasPrev && (
              <p className={`inline-flex items-center gap-0.5 text-[11px] font-bold mt-1 ${balance - prevBalance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {balance - prevBalance >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{monthName(prevMonth)}より {signedYen(balance - prevBalance)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {[{ label: '収入', value: income, color: CHART_COLORS.income }, { label: '支出', value: expense, color: CHART_COLORS.expense }].map((x) => (
                <div key={x.label} className="rounded-2xl bg-slate-50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className="w-2 h-2 rounded-[3px]" style={{ backgroundColor: x.color }} />{x.label}</p>
                  <p className="text-lg font-black text-slate-800 tabular">{yen(x.value)}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* ふりかえりのポイント */}
          {points.length > 0 && (
            <Card className="p-5 mb-6 !bg-amber-50/70 !border-amber-100">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5 mb-2"><Lightbulb size={15} className="text-amber-500" /> ふりかえりのポイント</h3>
              <ul className="space-y-1.5">
                {points.map((p) => <li key={p} className="text-xs font-bold text-slate-600 leading-relaxed">・{p}</li>)}
              </ul>
            </Card>
          )}

          {/* ふたりで使ったお金 */}
          <Card className="p-5 mb-6">
            <h3 className="font-black text-sm text-slate-800 mb-3">ふたりで使ったお金</h3>
            <dl className="space-y-2 text-xs">
              {[{ label: '日常', now: sharedTotal(cur), before: sharedTotal(prev) }, { label: '旅行', now: tripTotal(cur), before: tripTotal(prev) }].map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-2">
                  <dt className="font-bold text-slate-500">{r.label}</dt>
                  <dd className="tabular text-right">
                    <span className="font-black text-slate-800">{yen(r.now)}</span>
                    {hasPrev && r.now !== r.before && <span className="ml-2 text-[10px] font-bold text-slate-400">{monthName(prevMonth)}より {signedYen(r.now - r.before)}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-[10px] text-slate-400 mt-2">ふたりの支出の総額です（精算前・おごりを含む）</p>
          </Card>

          {/* 増えた・減った分類 */}
          {hasPrev && (increased.length > 0 || decreased.length > 0) && (
            <Card className="p-5 mb-6">
              <h3 className="font-black text-sm text-slate-800 mb-3">{monthName(prevMonth)}と比べて<span className="ml-1.5 text-[10px] font-bold text-slate-400">自分の分</span></h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[{ title: '増えた', list: increased, Icon: ArrowUpRight, tone: 'text-rose-500' }, { title: '減った', list: decreased, Icon: ArrowDownRight, tone: 'text-emerald-600' }].map(({ title, list, Icon, tone }) => (
                  <div key={title}>
                    <p className={`flex items-center gap-0.5 text-[10px] font-bold mb-1.5 ${tone}`}><Icon size={12} />{title}</p>
                    {list.length === 0 ? <p className="text-[11px] text-slate-400">なし</p> : (
                      <ul className="space-y-1">
                        {list.map((g) => (
                          <li key={g.id} className="flex justify-between gap-1 min-w-0">
                            <span className="font-bold text-slate-600 truncate">{g.icon} {g.label}</span>
                            <span className="font-bold text-slate-800 tabular shrink-0">{signedYen(g.diff)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 予算の結果 */}
          <Card className="p-5 mb-6">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5 mb-3"><Target size={15} className="text-slate-500" /> 予算の結果</h3>
            {budgetRows.length === 0 ? (
              <Link href="/budget" className="text-xs font-bold text-slate-500 underline underline-offset-2">月の予算を決めると、ここで結果を見られます</Link>
            ) : (
              <ul className="space-y-1.5">
                {budgetRows.map((r) => (
                  <li key={`${r.scope}-${r.id}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-600 truncate"><span className="text-[10px] text-slate-400 mr-1">{r.scope}</span>{r.icon} {r.label}</span>
                    <span className={`font-bold tabular shrink-0 ${r.level === 'over' ? 'text-rose-600' : 'text-slate-700'}`}>
                      {yen(r.spent)} / {yen(r.budget)}{r.level === 'over' ? ` ・ ${yen(-r.remaining)} 超過` : ' ・ 予算内'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <FixedCostCard entries={cur} myUserId={myUserId} monthCount={1} />

          {/* 大きな支出 */}
          {biggest.length > 0 && (
            <Card className="p-5 mb-6">
              <h3 className="font-black text-sm text-slate-800 mb-3">大きな支出</h3>
              <ol className="space-y-1.5">
                {biggest.map((e, i) => (
                  <li key={e.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-600 truncate">{i + 1}. {e.store_name || '店名なし'}<span className="ml-1.5 text-[10px] text-slate-400">{e.source === 'shared' ? 'ふたり' : e.source === 'trip' ? '旅行' : '個人'}</span></span>
                    <span className="font-black text-slate-800 tabular shrink-0">{yen(e.amount)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">数字は見ている人の分です（ふたりの収入・支出は半分、個人は本人の分だけ）。<br />{monthFrom.slice(0, 4)}年{monthName(month)}の記録をもとにしています</p>
        </>
      )}
    </PageShell>
  );
}
