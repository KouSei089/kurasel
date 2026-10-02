'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import { PageShell, PageHeader, Card, SectionTitle, Field, ChoiceButton, MonthSwitcher, EmptyState, Loading, buttonClass, inputClass } from '../components/ui';
import { Check, Loader2, Lock, Pencil, Trash2, Users } from 'lucide-react';
import { INCOME_CATEGORIES, findIncomeCategory, type Income, type IncomeScope } from '../lib/income';
import { DEMO_INCOMES } from '../lib/demoData';
import { useCurrentUser } from '../lib/useCurrentUser';
import { toLocalYMD } from '../lib/date';

// 収入の記録。?scope=personal で個人（本人だけ）、それ以外はふたりの収入。
// 精算には使わず、分析の収支で使う。
// useSearchParams を使う部分は Suspense で包む必要がある（Next.js の静的生成のため）
export default function IncomePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50"></div>}>
      <IncomePage />
    </Suspense>
  );
}

const SCOPES: { id: IncomeScope; label: string; icon: typeof Users }[] = [
  { id: 'shared', label: 'ふたりの収入', icon: Users },
  { id: 'personal', label: '自分の収入', icon: Lock },
];

const formatYMD = (ymd: string) => (ymd ? ymd.replaceAll('-', '/') : '');

function IncomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope: IncomeScope = searchParams.get('scope') === 'personal' ? 'personal' : 'shared';
  const { isDemoMode, myUserId, myUserName, nameOf } = useCurrentUser();
  const formRef = useRef<HTMLDivElement>(null);

  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // 入力フォーム (editingId があれば編集中)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [receivedDate, setReceivedDate] = useState(toLocalYMD(new Date()));
  const [category, setCategory] = useState(scope === 'personal' ? 'salary' : 'benefit');
  const [isSaving, setIsSaving] = useState(false);

  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const closeModal = () => setModal((m) => ({ ...m, isOpen: false }));

  const fetchKey = `${scope}_${toLocalYMD(month)}_${reloadKey}`;

  useEffect(() => {
    if (!myUserId || isDemoMode) return;
    let cancelled = false;
    const first = toLocalYMD(month);
    const last = toLocalYMD(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    let query = supabase.from('incomes').select('*').eq('is_shared', scope === 'shared');
    if (scope === 'personal') query = query.eq('owner', myUserId);
    query
      .gte('received_date', first)
      .lte('received_date', last)
      .order('received_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        else setIncomes(data || []);
        setLoadedKey(fetchKey);
      });
    return () => { cancelled = true; };
  }, [myUserId, isDemoMode, scope, month, fetchKey]);

  // デモは月に関係なく見本を出す（ほかの画面と同じ扱い）
  const shown: Income[] = isDemoMode
    ? DEMO_INCOMES.filter((i) => (scope === 'shared' ? i.is_shared : !i.is_shared && i.owner === myUserId))
    : incomes;
  const isLoading = !isDemoMode && loadedKey !== fetchKey;
  const total = shown.reduce((sum, i) => sum + i.amount, 0);

  const checkDemo = () => {
    if (isDemoMode) { alert('⚠️ DEMOモード中はこの操作はできません'); return true; }
    return false;
  };

  const resetForm = (nextScope = scope) => {
    setEditingId(null);
    setSource('');
    setAmount('');
    setReceivedDate(toLocalYMD(new Date()));
    setCategory(nextScope === 'personal' ? 'salary' : 'benefit');
  };

  const changeScope = (next: IncomeScope) => {
    if (next === scope) return;
    resetForm(next);
    router.replace(next === 'personal' ? '/income?scope=personal' : '/income');
  };

  const handleSave = async () => {
    if (!(Number(amount) > 0) || !receivedDate) { alert('金額と日付を入力してください'); return; }
    if (checkDemo()) return;
    setIsSaving(true);
    const values = { source: source.trim() || null, amount: Number(amount), received_date: receivedDate, category };
    // 世帯・記録した人は DB の既定値で入る
    const { error } = editingId
      ? await supabase.from('incomes').update(values).eq('id', editingId)
      : await supabase.from('incomes').insert({ ...values, is_shared: scope === 'shared' });
    setIsSaving(false);
    if (error) { console.error(error); alert('保存に失敗しました'); return; }
    resetForm();
    setReloadKey((k) => k + 1);
  };

  const handleEditClick = (item: Income) => {
    if (checkDemo()) return;
    setEditingId(item.id);
    setSource(item.source ?? '');
    setAmount(String(item.amount));
    setReceivedDate(item.received_date);
    setCategory(findIncomeCategory(item.category).id);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteClick = (item: Income) => {
    if (checkDemo()) return;
    setModal({
      isOpen: true,
      title: '収入の削除',
      message: `「${item.source || findIncomeCategory(item.category).label}」（${item.amount.toLocaleString()}円）を削除してもよろしいですか？`,
      onConfirm: async () => {
        closeModal();
        const { error } = await supabase.from('incomes').delete().eq('id', item.id);
        if (error) { console.error(error); alert('削除に失敗しました'); return; }
        if (editingId === item.id) resetForm();
        setIncomes((prev) => prev.filter((i) => i.id !== item.id));
      },
    });
  };

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  const isPersonal = scope === 'personal';

  return (
    <PageShell isDemoMode={isDemoMode} tone={isPersonal ? 'personal' : 'daily'}>
      <Modal isOpen={modal.isOpen} onClose={closeModal} type="confirm" title={modal.title} message={modal.message} confirmText="削除する" onConfirm={modal.onConfirm} />

      <PageHeader
        title="収入"
        subtitle={isPersonal
          ? <span className="inline-flex items-center gap-1"><Lock size={11} /> {myUserName}さんだけに表示される収入です</span>
          : 'ふたりで受け取ったお金（給付金・お祝いなど）'}
        isDemoMode={isDemoMode}
        back={isPersonal ? { href: '/personal', label: '個人' } : { href: '/', label: '記録' }}
      />

      <div className="grid grid-cols-2 gap-2 mb-4">
        {SCOPES.map(({ id, label, icon: Icon }) => (
          <ChoiceButton key={id} selected={scope === id} onClick={() => changeScope(id)} className="py-2.5 text-sm font-bold flex items-center justify-center gap-1.5">
            <Icon size={14} /> {label}
          </ChoiceButton>
        ))}
      </div>

      <MonthSwitcher month={month} onChange={(m) => { setMonth(m); resetForm(); }} />

      {isLoading ? <Loading /> : (
        <>
          <div className="relative overflow-hidden rounded-3xl p-6 text-white bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-600/20 mb-6">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 pointer-events-none"></div>
            <p className="relative text-xs font-bold text-white/80 mb-1">{month.getMonth() + 1}月の{isPersonal ? '自分の' : 'ふたりの'}収入</p>
            <p className="relative font-black leading-tight">
              <span className="text-4xl tabular tracking-tight">{total.toLocaleString()}</span>
              <span className="text-lg ml-1">円</span>
            </p>
            <p className="relative text-[11px] font-bold text-white/75 mt-2">{shown.length}件の記録 ・ 精算には含まれません</p>
          </div>

          {/* 入力フォーム */}
          <div ref={formRef} className="scroll-mt-4 mb-8">
            <Card className={`p-5 ${editingId ? 'ring-2 ring-emerald-300' : ''}`}>
              <SectionTitle tone={isPersonal ? 'personal' : 'daily'} right={editingId && <button onClick={() => resetForm()} className="text-xs font-bold text-slate-400 hover:text-slate-600">編集をやめる</button>}>
                {editingId ? '収入の編集' : '収入を記録'}
              </SectionTitle>
              <div className="space-y-4">
                <Field label="内容（任意）">
                  <input value={source} onChange={(e) => setSource(e.target.value)} placeholder={isPersonal ? '勤務先, 副業など' : '児童手当, お祝いなど'} className={inputClass} />
                </Field>
                <div className="flex flex-col min-[360px]:flex-row gap-3">
                  <Field label="金額 (円)" className="flex-1 min-w-0">
                    <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`${inputClass} text-right text-xl font-black tabular`} />
                  </Field>
                  <Field label="受け取った日" className="w-full min-[360px]:w-[46%] shrink-0">
                    <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={`${inputClass} !px-3 text-sm h-[56px]`} />
                  </Field>
                </div>
                <Field label="分類">
                  <div className="grid grid-cols-4 gap-1.5">
                    {INCOME_CATEGORIES.map((c) => (
                      <ChoiceButton key={c.id} selected={category === c.id} onClick={() => setCategory(c.id)} className="flex flex-col items-center py-2 min-w-0">
                        <span className="text-lg leading-none mb-1">{c.icon}</span>
                        <span className="text-[10px] font-bold whitespace-nowrap">{'short' in c ? c.short : c.label}</span>
                      </ChoiceButton>
                    ))}
                  </div>
                </Field>
              </div>
              <button onClick={handleSave} disabled={isSaving} className={`${buttonClass.primary} w-full mt-6 py-4 text-base`}>
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check strokeWidth={3} size={20} />}{editingId ? '更新する' : '記録する'}
              </button>
            </Card>
          </div>

          {/* 履歴 */}
          <h3 className="font-black text-slate-800 mb-3 ml-1 flex items-baseline gap-2 whitespace-nowrap">履歴<span className="text-xs font-bold text-slate-400">{shown.length}件</span></h3>
          {shown.length === 0 ? (
            <EmptyState icon="💴" title="この月の収入の記録はまだありません" />
          ) : (
            <ul className="space-y-3">
              {shown.map((item) => {
                const cat = findIncomeCategory(item.category);
                return (
                  <li key={item.id}>
                    <Card className={`p-4 flex items-center gap-2.5 min-[360px]:gap-3 ${editingId === item.id ? 'ring-2 ring-emerald-300' : ''}`}>
                      <span className="text-xl w-10 h-10 min-[360px]:text-2xl min-[360px]:w-12 min-[360px]:h-12 shrink-0 flex items-center justify-center bg-emerald-50 rounded-2xl">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 leading-snug line-clamp-2 [overflow-wrap:anywhere]">{item.source || cat.label}</p>
                        <p className="text-slate-400 text-[11px] font-bold tabular flex items-center gap-1.5 flex-wrap">
                          {formatYMD(item.received_date)}
                          <span>{cat.label}</span>
                          {!isPersonal && <span className="px-1.5 rounded-full bg-slate-100 text-slate-500">{nameOf(item.owner)}が記録</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-lg text-emerald-600 tabular">+¥{item.amount.toLocaleString()}</p>
                        <div className="flex justify-end -mr-1.5">
                          <button onClick={() => handleEditClick(item)} className={buttonClass.icon} aria-label="編集"><Pencil size={15} /></button>
                          <button onClick={() => handleDeleteClick(item)} className={`${buttonClass.icon} hover:!text-rose-500`} aria-label="削除"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </PageShell>
  );
}
