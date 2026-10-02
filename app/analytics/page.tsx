'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { PageShell, PageHeader, Card, MonthSwitcher, ChoiceButton, CategoryBreakdown, EmptyState, Loading, buttonClass, inputClass } from '../components/ui';
import { CATEGORY_GROUPS, findCategory, findGroup, groupOf, sumByCategory } from '../lib/categories';
import { Entry, Period, SOURCE_LABEL, Source, loadEntries, loadIncomes, myShare, periodRange, trendMonths } from '../lib/analytics';
import { myIncomeShare, type Income } from '../lib/income';
import { DEMO_EXPENSES, DEMO_INCOMES, DEMO_PERSONAL_EXPENSES, DEMO_TRIPS, DEMO_TRIP_EXPENSES } from '../lib/demoData';
import { useCurrentUser } from '../lib/useCurrentUser';
import { todayYMD } from '../lib/date';

// ふたり・旅行・個人の支出をまとめて見る分析画面。期間と絞り込みを変えて、合計・分類・推移・明細を見る

const SOURCES: Source[] = ['shared', 'trip', 'personal'];
// ふたり・旅行・個人の色は、各画面の色（ネイビー・スカイ・バイオレット）と同じ
const SOURCE_DOT: Record<Source, string> = { shared: 'bg-slate-700', trip: 'bg-sky-500', personal: 'bg-violet-500' };
const TREND_COLOR = '#334155';

const demoEntries = (): Entry[] => [
  ...DEMO_EXPENSES.map((e) => ({ key: `shared-${e.id}`, source: 'shared' as const, store_name: e.store_name, amount: e.amount, date: e.purchase_date, category: e.category, paid_by: e.paid_by, is_excluded: e.is_excluded })),
  ...DEMO_TRIP_EXPENSES.map((e) => ({ key: `trip-${e.id}`, source: 'trip' as const, store_name: e.store_name, amount: e.amount, date: e.purchase_date, category: e.category, paid_by: e.paid_by, is_excluded: e.is_excluded, trip_name: DEMO_TRIPS.find((t) => t.id === e.trip_id)?.name })),
  ...DEMO_PERSONAL_EXPENSES.map((e) => ({ key: `personal-${e.id}`, source: 'personal' as const, store_name: e.store_name, amount: e.amount, date: e.purchase_date, category: e.category, paid_by: null, is_excluded: false })),
];

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
const formatYMD = (ymd: string) => ymd.replaceAll('-', '/');

export default function AnalyticsPage() {
  const { isDemoMode, myUserId, myUserName, nameOf } = useCurrentUser();

  // デモの見本は2024年のデータなので、デモでは2024年を最初に出す
  const [period, setPeriod] = useState<Period>(() => {
    const now = new Date();
    const demo = typeof window !== 'undefined' && localStorage.getItem('kurasel_mode') === 'demo';
    return { mode: demo ? 'year' : 'month', month: new Date(now.getFullYear(), now.getMonth(), 1), year: demo ? 2024 : now.getFullYear(), from: todayYMD().slice(0, 8) + '01', to: todayYMD() };
  });
  const [amountMode, setAmountMode] = useState<'total' | 'share'>('total');
  const [sources, setSources] = useState<Source[]>(SOURCES);
  const [categories, setCategories] = useState<string[]>([]); // 大分類の id。空ならすべて
  const [payer, setPayer] = useState<'all' | 'me' | 'partner'>('all');
  const [keyword, setKeyword] = useState('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loadedKey, setLoadedKey] = useState('');

  const [from, to] = periodRange(period);
  const months = trendMonths(period);
  // 推移グラフの分も含めて読む
  const fetchFrom = months[0] + '-01' < from ? months[0] + '-01' : from;
  const fetchKey = `${fetchFrom}_${to}`;

  useEffect(() => {
    if (!myUserId || isDemoMode) return;
    let cancelled = false;
    Promise.all([loadEntries(fetchFrom, to, myUserId), loadIncomes(fetchFrom, to, myUserId)]).then(([data, incomeData]) => {
      if (cancelled) return;
      setEntries(data);
      setIncomes(incomeData);
      setLoadedKey(fetchKey);
    });
    return () => { cancelled = true; };
  }, [myUserId, isDemoMode, fetchFrom, to, fetchKey]);

  const all = isDemoMode ? demoEntries() : entries;
  const isLoading = !isDemoMode && loadedKey !== fetchKey;

  // 期間以外の絞り込み（推移グラフにも効かせる）
  const matchesFilters = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return (e: Entry) =>
      sources.includes(e.source) &&
      (categories.length === 0 || categories.includes(groupOf(e.category))) &&
      (payer === 'all' || (payer === 'me' ? e.source === 'personal' || e.paid_by === myUserId : e.source !== 'personal' && e.paid_by !== myUserId)) &&
      (!kw || e.store_name?.toLowerCase().includes(kw) || e.trip_name?.toLowerCase().includes(kw));
  }, [sources, categories, payer, keyword, myUserId]);

  // 収支（自分の分）。絞り込みには関係なく、期間内のすべてで出す。
  // 相手の個人の収入・支出は見えないので、ふたりの分は半分ずつにした「自分の分」で比べる
  const periodIncomes = (isDemoMode ? DEMO_INCOMES : incomes).filter((i) => i.received_date >= from && i.received_date <= to);
  const incomeMine = periodIncomes.reduce((sum, i) => sum + myIncomeShare(i), 0);
  const expenseMine = all.filter((e) => e.date >= from && e.date <= to).reduce((sum, e) => sum + myShare(e, myUserId), 0);
  const balanceMine = incomeMine - expenseMine;

  const value = (e: Entry) => (amountMode === 'total' ? e.amount : myShare(e, myUserId));

  const filtered = all.filter(matchesFilters);
  const inPeriod = filtered.filter((e) => e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date));
  const total = inPeriod.reduce((sum, e) => sum + value(e), 0);
  const bySource = SOURCES.map((s) => ({ source: s, value: inPeriod.filter((e) => e.source === s).reduce((sum, e) => sum + value(e), 0) }));
  const categoryItems = sumByCategory(inPeriod.map((e) => ({ amount: value(e), category: e.category })));

  const trend = months.map((m) => ({ month: m, value: filtered.filter((e) => e.date.startsWith(m)).reduce((sum, e) => sum + value(e), 0) }));
  const trendMax = Math.max(...trend.map((t) => t.value), 1);
  const focusMonth = selectedMonth && months.includes(selectedMonth) ? selectedMonth : months[months.length - 1];
  const focus = trend.find((t) => t.month === focusMonth);

  const hasFilter = sources.length < SOURCES.length || categories.length > 0 || payer !== 'all' || keyword.trim() !== '';
  const resetFilters = () => { setSources(SOURCES); setCategories([]); setPayer('all'); setKeyword(''); };
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <PageShell isDemoMode={isDemoMode}>
      <PageHeader title="分析" subtitle="ふたり・旅行・個人の支出をまとめて見ます" isDemoMode={isDemoMode} />

      {/* 期間 */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {([['month', '月'], ['year', '年'], ['range', '期間']] as const).map(([mode, label]) => (
          <ChoiceButton key={mode} selected={period.mode === mode} onClick={() => { setPeriod({ ...period, mode }); setSelectedMonth(null); }} className="py-2 text-sm font-bold">{label}</ChoiceButton>
        ))}
      </div>
      {period.mode === 'month' && <MonthSwitcher month={period.month} onChange={(m) => { setPeriod({ ...period, month: m }); setSelectedMonth(null); }} />}
      {period.mode === 'year' && (
        <Card className="flex items-center justify-between p-1.5 mb-6">
          <button onClick={() => setPeriod({ ...period, year: period.year - 1 })} className="p-3 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition" aria-label="前の年"><ChevronLeft size={20} /></button>
          <span className="font-black text-lg text-slate-800 tabular">{period.year}年</span>
          <button onClick={() => setPeriod({ ...period, year: period.year + 1 })} className="p-3 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition" aria-label="次の年"><ChevronRight size={20} /></button>
        </Card>
      )}
      {period.mode === 'range' && (
        <Card className="p-3 mb-6 flex flex-col min-[360px]:flex-row items-stretch min-[360px]:items-center gap-2">
          <input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} className={`${inputClass} !px-3 !py-2 text-sm flex-1`} aria-label="開始日" />
          <span className="text-center text-xs font-bold text-slate-400">〜</span>
          <input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} className={`${inputClass} !px-3 !py-2 text-sm flex-1`} aria-label="終了日" />
        </Card>
      )}

      {/* 絞り込み */}
      <Card className="p-4 mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-sm text-slate-800">絞り込み</h3>
          {hasFilter && <button onClick={resetFilters} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600"><X size={12} /> 解除</button>}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {SOURCES.map((s) => (
            <ChoiceButton key={s} selected={sources.includes(s)} onClick={() => setSources((prev) => (toggle(prev, s).length ? toggle(prev, s) : prev))} className="py-2 text-xs font-bold flex items-center justify-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ring-2 ring-white ${SOURCE_DOT[s]}`} />{SOURCE_LABEL[s]}
            </ChoiceButton>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {([['all', '全員'], ['me', '自分が払った'], ['partner', '相手が払った']] as const).map(([id, label]) => (
            <ChoiceButton key={id} selected={payer === id} onClick={() => setPayer(id)} className="py-2 text-[11px] font-bold whitespace-nowrap">{label}</ChoiceButton>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="店名・旅行名で探す" className={`${inputClass} !py-2.5 pl-10 text-sm`} />
        </div>
        <div>
          <button onClick={() => setShowCategoryFilter(!showCategoryFilter)} className="w-full flex items-center justify-between text-xs font-bold text-slate-500 py-1">
            <span>分類：{categories.length === 0 ? 'すべて' : categories.map((id) => findGroup(id).label).join('・')}</span>
            <ChevronDown size={14} className={`transition-transform ${showCategoryFilter ? 'rotate-180' : ''}`} />
          </button>
          {showCategoryFilter && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {CATEGORY_GROUPS.map((c) => (
                <button key={c.id} onClick={() => setCategories((prev) => toggle(prev, c.id))} className={`px-2.5 py-1 rounded-full border text-[11px] font-bold transition-colors ${categories.includes(c.id) ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {isLoading ? <Loading /> : (
        <>
          {/* 合計 */}
          <div className="relative overflow-hidden rounded-3xl p-6 text-white bg-gradient-to-br from-slate-700 to-slate-900 shadow-xl shadow-slate-800/25 mb-3">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 pointer-events-none"></div>
            <div className="relative flex gap-1 p-1 bg-white/10 rounded-full w-fit mb-4">
              {([['total', '支出の総額'], ['share', '自分の負担分']] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setAmountMode(mode)} className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${amountMode === mode ? 'bg-white text-slate-800' : 'text-white/70'}`}>{label}</button>
              ))}
            </div>
            <p className="relative font-black leading-tight">
              <span className="text-4xl tabular tracking-tight">{Math.round(total).toLocaleString()}</span>
              <span className="text-lg ml-1">円</span>
            </p>
            <p className="relative text-[11px] font-bold text-white/70 mt-2">
              {inPeriod.length}件{amountMode === 'share' && ' ・ ふたり・旅行は半分、おごりは払った人、個人は全額で計算'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {bySource.map(({ source, value: v }) => (
              <Card key={source} className={`p-3 ${sources.includes(source) ? '' : 'opacity-40'}`}>
                <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mb-0.5"><span className={`w-2 h-2 rounded-full ${SOURCE_DOT[source]}`} />{SOURCE_LABEL[source]}</p>
                <p className="text-sm min-[360px]:text-base font-black text-slate-800 tabular truncate">{yen(v)}</p>
              </Card>
            ))}
          </div>

          {/* 収支（自分の分） */}
          <Card className="p-5 mb-6">
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <h3 className="font-black text-sm text-slate-800">収支<span className="text-[10px] font-bold text-slate-400 ml-1.5">自分の分</span></h3>
              <span className={`text-lg font-black tabular ${balanceMine >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{balanceMine >= 0 ? '+' : '−'}{yen(Math.abs(balanceMine))}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl bg-emerald-50 px-3 py-2">
                <p className="font-bold text-emerald-700/70">収入</p>
                <p className="font-black text-emerald-700 tabular">{yen(incomeMine)}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2">
                <p className="font-bold text-slate-500">支出</p>
                <p className="font-black text-slate-700 tabular">{yen(expenseMine)}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              {periodIncomes.length === 0
                ? <>収入が未登録です。<Link href="/income" className="font-bold text-slate-600 underline underline-offset-2">収入を記録</Link>すると、貯金できた額がわかります</>
                : 'ふたりの収入・支出は半分、おごりは払った人、個人は全額で計算（絞り込みは反映しません）'}
            </p>
          </Card>

          {/* 月ごとの推移（1系列なので凡例なし。棒を押すとその月の金額を出す） */}
          <Card className="p-5 mb-6">
            <div className="flex items-baseline justify-between gap-2 mb-4">
              <h3 className="font-black text-sm text-slate-800">月ごとの推移</h3>
              {focus && <span className="text-xs font-bold text-slate-500 tabular">{Number(focus.month.slice(5))}月 <span className="text-slate-800 font-black">{yen(focus.value)}</span></span>}
            </div>
            <div className="flex items-end gap-0.5 h-32 border-b border-slate-200" role="img" aria-label="月ごとの支出の推移">
              {trend.map((t) => {
                const isFocus = t.month === focusMonth;
                return (
                  <button
                    key={t.month}
                    onClick={() => setSelectedMonth(t.month)}
                    onMouseEnter={() => setSelectedMonth(t.month)}
                    className="flex-1 h-full flex flex-col justify-end items-center group"
                    aria-label={`${t.month.replace('-', '年')}月 ${yen(t.value)}`}
                  >
                    <span
                      className={`w-full max-w-7 rounded-t-[4px] transition-opacity ${isFocus ? 'opacity-100' : 'opacity-35 group-hover:opacity-60'}`}
                      style={{ height: `${(t.value / trendMax) * 100}%`, minHeight: t.value > 0 ? 2 : 0, backgroundColor: TREND_COLOR }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="flex gap-0.5 mt-1.5">
              {trend.map((t, i) => (
                <span key={t.month} className={`flex-1 text-center text-[9px] font-bold tabular ${t.month === focusMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                  {/* 12か月以上は1つおきに月を出す */}
                  {trend.length > 8 && i % 2 === 1 && t.month !== focusMonth ? '' : Number(t.month.slice(5))}
                </span>
              ))}
            </div>
          </Card>

          <CategoryBreakdown title="分類別" items={categoryItems} />

          {/* 明細 */}
          <h3 className="font-black text-slate-800 mb-3 ml-1 flex items-baseline gap-2 whitespace-nowrap">明細<span className="text-xs font-bold text-slate-400">{inPeriod.length}件</span></h3>
          {inPeriod.length === 0 ? (
            <EmptyState icon="🔍" title="条件に合う支出はありません" description={hasFilter ? '絞り込みを解除すると表示されるかもしれません' : undefined} />
          ) : (
            <>
              <ul className="space-y-2">
                {inPeriod.slice(0, visibleCount).map((e) => {
                  const cat = findCategory(e.category);
                  const shown = value(e);
                  return (
                    <li key={e.key}>
                      <Card className="p-3 flex items-center gap-2.5">
                        <span className="text-lg w-9 h-9 shrink-0 flex items-center justify-center bg-slate-100 rounded-xl">{cat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-800 truncate">{e.store_name || '店名なし'}</p>
                          <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 min-w-0">
                            <span className="tabular shrink-0">{formatYMD(e.date)}</span>
                            <span className="flex items-center gap-1 truncate"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SOURCE_DOT[e.source]}`} />{e.source === 'trip' && e.trip_name ? e.trip_name : SOURCE_LABEL[e.source]}</span>
                            {e.paid_by && <span className="truncate">・{nameOf(e.paid_by)}</span>}
                            {e.is_excluded && <span className="text-amber-600 shrink-0">・おごり</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-slate-800 tabular">{yen(shown)}</p>
                          {amountMode === 'share' && shown !== e.amount && <p className="text-[10px] font-bold text-slate-400 tabular">総額 {yen(e.amount)}</p>}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
              {inPeriod.length > visibleCount && (
                <button onClick={() => setVisibleCount((c) => c + 30)} className={`${buttonClass.secondary} w-full py-3 mt-4 text-xs`}>もっと見る <ChevronDown size={14} /></button>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
