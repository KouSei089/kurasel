'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import { PageShell, PageHeader, Card, SectionTitle, Field, ChoiceButton, buttonClass, inputClass } from '../../components/ui';
import { AlertTriangle, Check, CheckCircle2, ImageUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { scanPayslip, type PayslipDeductionType } from '../../lib/receipt';
import { findCategory } from '../../lib/categories';
import { useCurrentUser } from '../../lib/useCurrentUser';

// 給与明細・賞与明細のスクリーンショットから取り込む。
// 総支給額を自分の収入（給与・賞与）に、天引きされた税金・社会保険料などを個人の支出に記録する。
// 控除は収入に紐づけて（personal_expenses.income_id）、収入を消すと一緒に消える

type Kind = 'salary' | 'bonus';

type Row = {
  key: string;
  name: string;
  amount: number;
  category: string;
  checked: boolean; // 支出として記録する（財形貯蓄など、支出ではないものは外せる）
};

// 控除の種類 → 個人の支出の分類
const CATEGORY_FOR: Record<PayslipDeductionType, string> = { social_insurance: 'social_insurance', tax: 'tax', other: 'other' };
// 控除に選べる分類
const DEDUCTION_CATEGORIES = ['social_insurance', 'tax', 'insurance', 'housing', 'other'];

const KIND_LABEL: Record<Kind, string> = { salary: '給与', bonus: '賞与' };

let rowSeq = 0;
const newKey = () => `row-${++rowSeq}`;

export default function PayslipImportPage() {
  const router = useRouter();
  const { isDemoMode, myUserId, myUserName } = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  const [kind, setKind] = useState<Kind>('salary');
  const [payDate, setPayDate] = useState('');
  const [employer, setEmployer] = useState('');
  const [gross, setGross] = useState('');
  const [readNet, setReadNet] = useState<number | null>(null); // 明細に書かれていた手取り（照らし合わせ用）
  const [rows, setRows] = useState<Row[]>([]);
  const [duplicate, setDuplicate] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });

  const grossAmount = Number(gross) || 0;
  const deductionTotal = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const takeHome = grossAmount - deductionTotal;
  const recordedTotal = rows.filter((r) => r.checked).reduce((sum, r) => sum + (r.amount || 0), 0);
  const matchesSlip = readNet !== null && readNet > 0 && takeHome === readNet;

  // 同じ日・同じ金額の収入がすでにあれば、二重登録かもしれないと知らせる
  const checkDuplicate = async (date: string, amount: number) => {
    if (!date || !amount || isDemoMode) { setDuplicate(false); return; }
    const { data } = await supabase.from('incomes').select('id').eq('is_shared', false).eq('owner', myUserId).eq('received_date', date).eq('amount', amount).limit(1);
    setDuplicate(!!data?.length);
  };

  const handleFile = async (file: File) => {
    setIsScanning(true);
    setScanError('');
    try {
      const slip = await scanPayslip(file);
      setKind(slip.kind);
      setPayDate(slip.pay_date ?? '');
      setEmployer(slip.employer);
      setGross(slip.gross ? String(slip.gross) : '');
      setReadNet(slip.net || null);
      setRows(slip.deductions.map((d) => ({ key: newKey(), name: d.name, amount: d.amount, category: CATEGORY_FOR[d.type], checked: true })));
      setIsLoaded(true);
      checkDuplicate(slip.pay_date ?? '', slip.gross);
    } catch (err) {
      console.error('Payslip scan error:', err);
      setScanError('読み取れませんでした。明細全体が写ったスクショで、もう一度お試しください');
    } finally {
      setIsScanning(false);
    }
  };

  const updateRow = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const handleRegister = async () => {
    if (!payDate || !(grossAmount > 0)) { alert('支給日と総支給額を入力してください'); return; }
    if (rows.some((r) => r.checked && (!r.name.trim() || !(r.amount > 0)))) { alert('控除の項目名・金額が空の行があります'); return; }
    if (isDemoMode) { alert('⚠️ DEMOモード中はこの操作はできません'); return; }

    setIsSaving(true);
    const month = Number(payDate.slice(5, 7));
    const { data: income, error: incomeError } = await supabase
      .from('incomes')
      .insert({ is_shared: false, source: employer.trim() || KIND_LABEL[kind], amount: grossAmount, received_date: payDate, category: kind })
      .select('id')
      .single();
    if (incomeError || !income) {
      console.error(incomeError);
      alert('登録に失敗しました');
      setIsSaving(false);
      return;
    }

    const deductions = rows.filter((r) => r.checked).map((r) => ({
      owner: myUserId,
      store_name: `${r.name.trim()}（${month}月${KIND_LABEL[kind]}）`,
      amount: r.amount,
      purchase_date: payDate,
      category: r.category,
      income_id: income.id,
    }));
    if (deductions.length > 0) {
      const { error } = await supabase.from('personal_expenses').insert(deductions);
      if (error) {
        // 控除だけ入らないと収支がずれるので、収入も取り消す
        console.error(error);
        await supabase.from('incomes').delete().eq('id', income.id);
        alert('登録に失敗しました');
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    setModal({
      isOpen: true,
      title: '登録しました ✨',
      message: `収入（${KIND_LABEL[kind]}）${grossAmount.toLocaleString()}円と、控除 ${deductions.length}件（${recordedTotal.toLocaleString()}円）を記録しました。`,
    });
  };

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <PageShell isDemoMode={isDemoMode} tone="personal">
      <Modal isOpen={modal.isOpen} onClose={() => setModal((m) => ({ ...m, isOpen: false }))} type="alert" title={modal.title} message={modal.message}
        onConfirm={() => router.push(`/income?scope=personal&month=${payDate.slice(0, 7)}`)} />

      <PageHeader title="給与明細から取り込む" subtitle="総支給を収入に、天引きされた税金・社会保険料を個人の支出に記録します" isDemoMode={isDemoMode} back={{ href: '/income?scope=personal', label: '収入' }} />

      <Card className="p-5 mb-6">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) handleFile(file); }} />
        <button onClick={() => inputRef.current?.click()} disabled={isScanning || isDemoMode} className={`${buttonClass.secondary} w-full py-3.5 text-sm`}>
          {isScanning ? <><Loader2 size={16} className="animate-spin" /> 読み取り中…</> : <><ImageUp size={16} /> 給与明細のスクショを選ぶ</>}
        </button>
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          {isDemoMode
            ? 'デモモードでは読み取りは使えません（ログインすると使えます）'
            : 'freee人事労務などの給与明細・賞与明細の画面を、支給・控除・差引支給額が全部入るように撮ってください。'}
        </p>
        {scanError && <p className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 mt-2"><AlertTriangle size={13} /> {scanError}</p>}
      </Card>

      {isLoaded && (
        <>
          <Card className="p-5 mb-4">
            <SectionTitle tone="personal">収入</SectionTitle>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['salary', 'bonus'] as Kind[]).map((k) => (
                  <ChoiceButton key={k} selected={kind === k} onClick={() => setKind(k)} className="py-2.5 text-sm font-bold">{k === 'salary' ? '💴 給与' : '🎉 賞与'}</ChoiceButton>
                ))}
              </div>
              <div className="flex flex-col min-[360px]:flex-row gap-3">
                <Field label="総支給額 (円)" className="flex-1 min-w-0">
                  <input type="number" inputMode="numeric" value={gross} onChange={(e) => setGross(e.target.value)} onBlur={() => checkDuplicate(payDate, grossAmount)} className={`${inputClass} text-right text-xl font-black tabular`} />
                </Field>
                <Field label="支給日" className="w-full min-[360px]:w-[46%] shrink-0">
                  <input type="date" value={payDate} onChange={(e) => { setPayDate(e.target.value); checkDuplicate(e.target.value, grossAmount); }} className={`${inputClass} !px-3 text-sm h-[56px]`} />
                </Field>
              </div>
              <Field label="勤務先（任意）">
                <input value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder="会社名" className={inputClass} />
              </Field>
              {duplicate && (
                <p className="flex items-center gap-1 text-[11px] font-bold text-amber-600"><AlertTriangle size={12} /> 同じ日・同じ金額の収入がすでに登録されています</p>
              )}
            </div>
          </Card>

          <Card className="p-5 mb-4">
            <SectionTitle tone="personal" right={<span className="text-xs font-black text-slate-700 tabular">¥{deductionTotal.toLocaleString()}</span>}>控除（天引き）</SectionTitle>
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.key} className={`rounded-2xl border border-slate-100 bg-white/70 p-2.5 ${r.checked ? '' : 'opacity-60'}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={r.checked} onChange={(e) => updateRow(r.key, { checked: e.target.checked })} className="w-5 h-5 shrink-0 accent-slate-800" aria-label="支出として記録する" />
                    <input value={r.name} onChange={(e) => updateRow(r.key, { name: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-200 focus:border-slate-300 focus:outline-none font-bold text-slate-800 text-sm bg-transparent" aria-label="項目名" />
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">¥</span>
                      <input type="number" inputMode="numeric" value={r.amount || ''} onChange={(e) => updateRow(r.key, { amount: Number(e.target.value) })} className="w-full pl-5 pr-2 py-1.5 rounded-lg border border-slate-200 text-sm font-black text-slate-800 text-right tabular bg-white" aria-label="金額" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pl-7">
                    <select value={r.category} onChange={(e) => updateRow(r.key, { category: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white" aria-label="分類">
                      {DEDUCTION_CATEGORIES.map((id) => { const c = findCategory(id); return <option key={id} value={id}>{c.icon} {c.label}</option>; })}
                    </select>
                    <button onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className={`${buttonClass.icon} hover:!text-rose-500`} aria-label="この行を消す"><Trash2 size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>
            <button onClick={() => setRows((prev) => [...prev, { key: newKey(), name: '', amount: 0, category: 'other', checked: true }])} className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 py-1.5">
              <Plus size={13} /> 控除を追加
            </button>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">チェックを外した控除（財形貯蓄など、支出ではないもの）は記録しません</p>
          </Card>

          {/* 手取りの照らし合わせ */}
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-500">手取り（総支給 − 控除）</span>
              <span className="font-black text-slate-800 tabular">¥{takeHome.toLocaleString()}</span>
            </div>
            {readNet !== null && (
              <p className={`flex items-center gap-1 text-[11px] font-bold mt-1.5 ${matchesSlip ? 'text-emerald-600' : 'text-amber-600'}`}>
                {matchesSlip
                  ? <><CheckCircle2 size={12} /> 明細の差引支給額 ¥{readNet.toLocaleString()} と一致しています</>
                  : <><AlertTriangle size={12} /> 明細の差引支給額 ¥{readNet.toLocaleString()} と {Math.abs(takeHome - readNet).toLocaleString()}円 違います。読み取りを確認してください</>}
              </p>
            )}
          </Card>

          {/* 下のタブに重ならないよう、タブの上に固定する */}
          <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30">
            <button onClick={handleRegister} disabled={isSaving} className={`${buttonClass.primary} w-full py-4 text-base shadow-xl`}>
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check strokeWidth={3} size={20} />}
              収入 ¥{grossAmount.toLocaleString()} と控除 {rows.filter((r) => r.checked).length}件を登録
            </button>
          </div>
        </>
      )}
    </PageShell>
  );
}
