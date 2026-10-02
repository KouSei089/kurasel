'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { PageShell, PageHeader, Card, ChoiceButton, Loading, buttonClass } from '../components/ui';
import { Check, Loader2, Lock, Users } from 'lucide-react';
import { BUDGET_TARGETS, TOTAL, loadBudgets, type Budget, type BudgetScope } from '../lib/budgets';
import { groupOf } from '../lib/categories';
import { DEMO_BUDGETS, DEMO_EXPENSES, DEMO_PERSONAL_EXPENSES } from '../lib/demoData';
import { useCurrentUser } from '../lib/useCurrentUser';
import { toLocalYMD } from '../lib/date';

// 月の予算の設定。?scope=personal で自分の予算（個人の支出と比べる）、それ以外はふたりの予算（日常のふたりの支出と比べる）。
// 大分類ごと（と全体）に毎月の金額を入れる。空にするとその予算は外す。
// useSearchParams を使う部分は Suspense で包む必要がある（Next.js の静的生成のため）
export default function BudgetPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50"></div>}>
      <BudgetPage />
    </Suspense>
  );
}

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

function BudgetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope: BudgetScope = searchParams.get('scope') === 'personal' ? 'personal' : 'shared';
  const isPersonal = scope === 'personal';
  const { isDemoMode, myUserId, myUserName } = useCurrentUser();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spent, setSpent] = useState<{ amount: number; category: string | null }[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadedKey, setLoadedKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  // 今月使った額（入力の目安に出す）
  const now = new Date();
  const first = toLocalYMD(new Date(now.getFullYear(), now.getMonth(), 1));
  const last = toLocalYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const fetchKey = `${scope}_${savedAt}`;

  useEffect(() => {
    if (!myUserId || isDemoMode) return;
    let cancelled = false;
    const spentQuery = isPersonal
      ? supabase.from('personal_expenses').select('amount, category').eq('owner', myUserId).gte('purchase_date', first).lte('purchase_date', last)
      : supabase.from('expenses').select('amount, category').eq('is_excluded', false).gte('purchase_date', first).lte('purchase_date', last);
    Promise.all([loadBudgets(scope, myUserId), spentQuery]).then(([b, s]) => {
      if (cancelled) return;
      if (s.error) console.error(s.error);
      setBudgets(b);
      setSpent(s.data ?? []);
      setDrafts(Object.fromEntries(b.map((x) => [x.category_group, String(x.amount)])));
      setLoadedKey(fetchKey);
    });
    return () => { cancelled = true; };
  }, [myUserId, isDemoMode, scope, isPersonal, first, last, fetchKey]);

  const demoBudgets = DEMO_BUDGETS.filter((b) => b.is_shared === !isPersonal);
  const shownBudgets = isDemoMode ? demoBudgets : budgets;
  const shownSpent = isDemoMode ? (isPersonal ? DEMO_PERSONAL_EXPENSES : DEMO_EXPENSES.filter((e) => !e.is_excluded)) : spent;
  const isLoading = !isDemoMode && loadedKey !== fetchKey;
  const valueOf = (id: string) => (isDemoMode ? String(demoBudgets.find((b) => b.category_group === id)?.amount ?? '') : drafts[id] ?? '');

  const spentFor = (id: string) => shownSpent.filter((s) => id === TOTAL || groupOf(s.category) === id).reduce((sum, s) => sum + s.amount, 0);
  const groupTotal = BUDGET_TARGETS.filter((t) => t.id !== TOTAL).reduce((sum, t) => sum + (Number(valueOf(t.id)) || 0), 0);

  const changeScope = (next: BudgetScope) => router.replace(next === 'personal' ? '/budget?scope=personal' : '/budget');

  const handleSave = async () => {
    if (isDemoMode) { alert('⚠️ DEMOモード中はこの操作はできません'); return; }
    setIsSaving(true);
    // 変わったところだけ書く: 空になったら消す、既存は更新、新しいものは追加
    const ops = BUDGET_TARGETS.map(async (t) => {
      const amount = Number((drafts[t.id] ?? '').normalize('NFKC').replace(/[^0-9]/g, '')) || 0;
      const existing = budgets.find((b) => b.category_group === t.id);
      if (!amount && existing) return supabase.from('budgets').delete().eq('id', existing.id);
      if (amount && existing && existing.amount !== amount) return supabase.from('budgets').update({ amount, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (amount && !existing) return supabase.from('budgets').insert({ is_shared: !isPersonal, category_group: t.id, amount });
      return { error: null };
    });
    const results = await Promise.all(ops);
    setIsSaving(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) { console.error(failed.error); alert('保存に失敗しました'); }
    setSavedAt(Date.now());
  };

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <PageShell isDemoMode={isDemoMode} tone={isPersonal ? 'personal' : 'daily'}>
      <PageHeader
        title="月の予算"
        subtitle={isPersonal ? '個人の支出と比べます（自分だけに表示）' : '日常のふたりの支出と比べます（おごりは含めません）'}
        isDemoMode={isDemoMode}
        back={isPersonal ? { href: '/personal', label: '個人' } : { href: '/settlement', label: '精算' }}
      />

      <div className="grid grid-cols-2 gap-2 mb-6">
        {([['shared', 'ふたりの予算', Users], ['personal', '自分の予算', Lock]] as const).map(([id, label, Icon]) => (
          <ChoiceButton key={id} selected={scope === id} onClick={() => changeScope(id)} className="py-2.5 text-sm font-bold flex items-center justify-center gap-1.5">
            <Icon size={14} /> {label}
          </ChoiceButton>
        ))}
      </div>

      {isLoading ? <Loading /> : (
        <>
          <Card className="p-5 mb-4">
            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">毎月の金額を入れてください。空のものは予算なしになります。分類名の下の小さな数字は、今月これまでに使った額です。</p>
            <ul className="space-y-2.5">
              {BUDGET_TARGETS.map((t) => (
                <li key={t.id} className={`flex items-center gap-3 ${t.id === TOTAL ? 'pb-3 mb-1 border-b border-slate-100' : ''}`}>
                  <span className="flex-1 min-w-0">
                    <span className={`block truncate ${t.id === TOTAL ? 'text-sm font-black text-slate-800' : 'text-xs font-bold text-slate-600'}`}>{t.icon} {t.label}</span>
                    <span className="block text-[10px] text-slate-400 tabular">今月 {yen(spentFor(t.id))}</span>
                  </span>
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">¥</span>
                    <input
                      type="number" inputMode="numeric" min={0}
                      value={valueOf(t.id)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                      placeholder="なし"
                      disabled={isDemoMode}
                      className="w-full pl-6 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-slate-800 text-right tabular bg-white placeholder:text-slate-300 placeholder:font-bold"
                      aria-label={`${t.label}の予算`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {groupTotal > 0 && (
            <p className="text-[11px] font-bold text-slate-500 mb-6 ml-1 tabular">分類ごとの予算の合計 {yen(groupTotal)}{Number(valueOf(TOTAL)) > 0 && Number(valueOf(TOTAL)) < groupTotal && <span className="text-amber-600">（全体の予算 {yen(Number(valueOf(TOTAL)))} を超えています）</span>}</p>
          )}

          <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30">
            <button onClick={handleSave} disabled={isSaving || isDemoMode} className={`${buttonClass.primary} w-full py-4 text-base shadow-xl`}>
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check strokeWidth={3} size={20} />}保存する
            </button>
          </div>
          {shownBudgets.length > 0 && <p className="text-center text-[10px] text-slate-400 mt-3">{isPersonal ? '個人' : '精算'}の画面で、毎月の進み具合を見られます</p>}
        </>
      )}
    </PageShell>
  );
}
