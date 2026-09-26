'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import { PageShell, PageHeader, Card, SectionTitle, Field, CategoryPicker, ChoiceButton, EmptyState, Loading, buttonClass, inputClass } from '../../components/ui';
import { BellRing, Check, Loader2, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { PERSONAL_CATEGORIES, findCategory } from '../../lib/categories';
import { Cycle, CYCLE_LABEL, Subscription, daysUntil, monthlyAmount, nextBillingDate, syncSubscriptions } from '../../lib/subscriptions';
import { DEMO_SUBSCRIPTIONS } from '../../lib/demoData';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { toLocalYMD, todayYMD } from '../../lib/date';

// 個人のサブスクの一覧・分析・登録。支払日が来たものは個人の支出に自動で記録される

const formatMD = (ymd: string) => { const [, m, d] = ymd.split('-'); return `${Number(m)}/${Number(d)}`; };
const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;
const dayLabel = (days: number) => (days === 0 ? '今日' : days === 1 ? '明日' : `あと${days}日`);

const demoSubscriptions = (): Subscription[] => DEMO_SUBSCRIPTIONS.map(({ daysFromToday, ...s }) => {
  const d = new Date(); d.setDate(d.getDate() + daysFromToday);
  return { ...s, next_billing_date: toLocalYMD(d), billing_day: d.getDate() };
});

export default function SubscriptionsPage() {
  const { isDemoMode, myUserName } = useCurrentUser();
  const formRef = useRef<HTMLDivElement>(null);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [recordedNotice, setRecordedNotice] = useState(0);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [nextDate, setNextDate] = useState(todayYMD);
  const [category, setCategory] = useState('hobby');
  const [isSaving, setIsSaving] = useState(false);

  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', confirmText: 'OK', onConfirm: () => {} });
  const closeModal = () => setModal((m) => ({ ...m, isOpen: false }));

  useEffect(() => {
    if (!myUserName || isDemoMode) return;
    let cancelled = false;
    // 先に支払日を過ぎた分を記録して、次の支払日を進めてから一覧を読む
    syncSubscriptions(myUserName).then((recorded) => {
      if (cancelled) return;
      if (recorded > 0) setRecordedNotice(recorded);
      return supabase.from('subscriptions').select('*').eq('owner', myUserName).then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        else setSubscriptions(data || []);
        setLoading(false);
      });
    });
    return () => { cancelled = true; };
  }, [myUserName, isDemoMode, reloadKey]);

  const shown = isDemoMode ? demoSubscriptions() : subscriptions;
  const isLoading = !isDemoMode && loading;

  const active = shown.filter((s) => s.is_active).sort((a, b) => monthlyAmount(b) - monthlyAmount(a));
  const inactive = shown.filter((s) => !s.is_active);
  const monthlyTotal = active.reduce((sum, s) => sum + monthlyAmount(s), 0);
  const today = todayYMD();
  const upcoming = active
    .map((s) => ({ ...s, days: daysUntil(s.next_billing_date, today) }))
    .filter((s) => s.days >= 0 && s.days <= 7)
    .sort((a, b) => a.days - b.days);

  const checkDemo = () => {
    if (isDemoMode) { alert('⚠️ DEMOモード中はこの操作はできません'); return true; }
    return false;
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setCycle('monthly');
    setNextDate(todayYMD());
    setCategory('hobby');
  };

  const handleSave = async () => {
    if (!name.trim() || !(Number(amount) > 0) || !nextDate) { alert('サービス名・金額・次の支払日を入力してください'); return; }
    if (checkDemo()) return;
    setIsSaving(true);
    const values = {
      name: name.trim(),
      amount: Number(amount),
      cycle,
      next_billing_date: nextDate,
      billing_day: Number(nextDate.split('-')[2]),
      category,
    };
    const { error } = editingId
      ? await supabase.from('subscriptions').update(values).eq('id', editingId)
      : await supabase.from('subscriptions').insert({ ...values, owner: myUserName, is_active: true });
    setIsSaving(false);
    if (error) { console.error(error); alert('保存に失敗しました'); return; }
    resetForm();
    setReloadKey((k) => k + 1);
  };

  const handleEdit = (s: Subscription) => {
    if (checkDemo()) return;
    setEditingId(s.id);
    setName(s.name);
    setAmount(String(s.amount));
    setCycle(s.cycle);
    setNextDate(s.next_billing_date);
    setCategory(s.category || 'other');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleToggleActive = (s: Subscription) => {
    if (checkDemo()) return;
    const resume = !s.is_active;
    setModal({
      isOpen: true,
      title: resume ? '再開する' : '休止・解約にする',
      message: resume
        ? `「${s.name}」を再開します。\n休止中に過ぎた支払日の分は記録しません。`
        : `「${s.name}」を休止・解約済みにします。\n合計から外れ、自動の記録も止まります。これまでの記録は残ります。`,
      confirmText: resume ? '再開する' : '休止・解約にする',
      onConfirm: async () => {
        closeModal();
        // 休止中に過ぎた支払日は記録しない。本来の周期のまま、今日以降で最初の支払日まで進める
        const patch: Partial<Subscription> = { is_active: resume };
        if (resume) {
          let next = s.next_billing_date;
          while (next < today) next = nextBillingDate(next, s.cycle, s.billing_day);
          patch.next_billing_date = next;
        }
        const { error } = await supabase.from('subscriptions').update(patch).eq('id', s.id);
        if (error) { console.error(error); alert('更新に失敗しました'); return; }
        setReloadKey((k) => k + 1);
      },
    });
  };

  const handleDelete = (s: Subscription) => {
    if (checkDemo()) return;
    setModal({
      isOpen: true,
      title: 'サブスクの削除',
      message: `「${s.name}」を削除します。\nこれまで自動で記録した支出は、個人の記録に残ります。`,
      confirmText: '削除する',
      onConfirm: async () => {
        closeModal();
        const { error } = await supabase.from('subscriptions').delete().eq('id', s.id);
        if (error) { console.error(error); alert('削除に失敗しました'); return; }
        if (editingId === s.id) resetForm();
        setReloadKey((k) => k + 1);
      },
    });
  };

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  const row = (s: Subscription) => {
    const cat = findCategory(PERSONAL_CATEGORIES, s.category);
    const share = monthlyTotal > 0 ? monthlyAmount(s) / monthlyTotal : 0;
    const days = daysUntil(s.next_billing_date, today);
    return (
      <li key={s.id}>
        <Card className={`p-4 ${editingId === s.id ? 'ring-2 ring-violet-300' : ''} ${s.is_active ? '' : 'opacity-70'}`}>
          <div className="flex items-center gap-2.5 min-[360px]:gap-3">
            <span className="text-xl w-10 h-10 min-[360px]:text-2xl min-[360px]:w-12 min-[360px]:h-12 shrink-0 flex items-center justify-center bg-slate-100 rounded-2xl">{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 leading-snug line-clamp-2 [overflow-wrap:anywhere]">{s.name}</p>
              <p className="text-[11px] font-bold text-slate-400 tabular">
                {s.is_active ? <>次回 {formatMD(s.next_billing_date)}（{dayLabel(Math.max(days, 0))}）</> : '休止・解約済み'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-lg text-slate-800 tabular">{yen(s.amount)}</p>
              <p className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{CYCLE_LABEL[s.cycle]}{s.cycle === 'yearly' && `（月${yen(monthlyAmount(s))}）`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            {s.is_active ? (
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-violet-400" style={{ width: `${share * 100}%` }} /></div>
                <span className="text-[10px] font-bold text-slate-400 tabular w-8 text-right">{Math.round(share * 100)}%</span>
              </div>
            ) : <div className="flex-1" />}
            <div className="flex shrink-0">
              <button onClick={() => handleToggleActive(s)} className={buttonClass.icon} aria-label={s.is_active ? '休止・解約にする' : '再開する'} title={s.is_active ? '休止・解約にする' : '再開する'}>{s.is_active ? <Pause size={15} /> : <Play size={15} />}</button>
              <button onClick={() => handleEdit(s)} className={buttonClass.icon} aria-label="編集"><Pencil size={15} /></button>
              <button onClick={() => handleDelete(s)} className={`${buttonClass.icon} hover:!text-rose-500`} aria-label="削除"><Trash2 size={15} /></button>
            </div>
          </div>
        </Card>
      </li>
    );
  };

  return (
    <PageShell isDemoMode={isDemoMode} tone="personal">
      <Modal isOpen={modal.isOpen} onClose={closeModal} type="confirm" title={modal.title} message={modal.message} confirmText={modal.confirmText} onConfirm={modal.onConfirm} />

      <PageHeader title="サブスク" subtitle="支払日が来ると、個人の支出に自動で記録します" isDemoMode={isDemoMode} back={{ href: '/personal', label: '個人' }} />

      {recordedNotice > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-2xl bg-violet-50 border border-violet-100 text-xs font-bold text-violet-700 animate-in">
          <Check size={14} /> 支払日を過ぎた {recordedNotice}件を個人の支出に記録しました
        </div>
      )}

      {isLoading ? <Loading /> : (
        <>
          <div className="relative overflow-hidden rounded-3xl p-6 text-white bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-600/20 mb-6">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 pointer-events-none"></div>
            <p className="relative text-xs font-bold text-white/80 mb-1">月あたりのサブスク</p>
            <p className="relative font-black leading-tight">
              <span className="text-4xl tabular tracking-tight">{Math.round(monthlyTotal).toLocaleString()}</span>
              <span className="text-lg ml-1">円</span>
            </p>
            <p className="relative text-[11px] font-bold text-white/75 mt-2">年間 {yen(monthlyTotal * 12)} ・ 利用中 {active.length}件</p>
          </div>

          {upcoming.length > 0 && (
            <Card className="p-4 mb-6">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5 mb-2"><BellRing size={15} className="text-violet-500" /> 7日以内の支払い</h3>
              <ul className="space-y-1.5">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 px-2 py-0.5 rounded-full font-bold ${s.days <= 1 ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-600'}`}>{dayLabel(s.days)}</span>
                      <span className="font-bold text-slate-600 truncate">{s.name}</span>
                    </span>
                    <span className="font-bold text-slate-700 tabular shrink-0">{yen(s.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <h3 className="font-black text-slate-800 mb-3 ml-1 flex items-baseline gap-2 whitespace-nowrap">利用中<span className="text-xs font-bold text-slate-400">金額の大きい順</span></h3>
          {active.length === 0 ? (
            <div className="mb-8"><EmptyState icon="📺" title="登録しているサブスクはありません" description="下のフォームから登録できます" /></div>
          ) : (
            <ul className="space-y-3 mb-8">{active.map(row)}</ul>
          )}

          <div ref={formRef} className="scroll-mt-4 mb-8">
            <Card className={`p-5 ${editingId ? 'ring-2 ring-violet-300' : ''}`}>
              <SectionTitle tone="personal" right={editingId && <button onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-slate-600">編集をやめる</button>}>
                {editingId ? 'サブスクの編集' : 'サブスクを登録'}
              </SectionTitle>
              <div className="space-y-4">
                <Field label="サービス名">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix, Spotify など" className={inputClass} />
                </Field>
                <div className="flex flex-col min-[360px]:flex-row gap-3">
                  <Field label="金額 (円)" className="flex-1 min-w-0">
                    <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`${inputClass} text-right text-xl font-black tabular`} />
                  </Field>
                  <Field label="支払いの周期" className="w-full min-[360px]:w-[46%] shrink-0">
                    <div className="grid grid-cols-2 gap-1.5 h-[56px]">
                      {(['monthly', 'yearly'] as Cycle[]).map((c) => (
                        <ChoiceButton key={c} selected={cycle === c} onClick={() => setCycle(c)} className="text-sm font-bold">{CYCLE_LABEL[c]}</ChoiceButton>
                      ))}
                    </div>
                  </Field>
                </div>
                <Field label="次の支払日">
                  <input type="date" value={nextDate} min={today} onChange={(e) => setNextDate(e.target.value)} className={`${inputClass} !px-3 text-sm h-[52px]`} />
                </Field>
                <Field label="カテゴリ">
                  <CategoryPicker categories={PERSONAL_CATEGORIES} value={category} onChange={setCategory} />
                </Field>
              </div>
              <button onClick={handleSave} disabled={isSaving} className={`${buttonClass.primary} w-full mt-6 py-4 text-base`}>
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check strokeWidth={3} size={20} />}{editingId ? '更新する' : '登録する'}
              </button>
            </Card>
          </div>

          {inactive.length > 0 && (
            <>
              <h3 className="font-black text-slate-800 mb-3 ml-1 whitespace-nowrap">休止・解約済み</h3>
              <ul className="space-y-3">{inactive.map(row)}</ul>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
