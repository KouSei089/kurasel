'use client';
import { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import { PageShell, PageHeader, Card, SectionTitle, ChoiceButton, buttonClass } from '../components/ui';
import { Check, ImageUp, Loader2, AlertTriangle, Smartphone, Send } from 'lucide-react';
import { scanHistory, type HistoryItem } from '../lib/receipt';
import { CATEGORIES, normalizeCategory } from '../lib/categories';
import { useCurrentUser } from '../lib/useCurrentUser';
import { todayYMD } from '../lib/date';

// 決済アプリ（ハーンPay など）の利用履歴のスクリーンショットから、支払いをまとめて取り込む。
// ハーンPay には外部連携の仕組みや履歴の書き出しがないため、画面を AI で読み取る方式にしている

type Destination = 'shared' | 'personal';

type Row = HistoryItem & {
  key: string;
  checked: boolean;
  duplicate: boolean; // 登録先に同じ日付・金額の記録がすでにある
  overlap: boolean; // 別のスクショにも同じ支払いが写っている
};

const DESTINATIONS: { id: Destination; label: string; description: string }[] = [
  { id: 'shared', label: 'ふたりの記録', description: '精算の対象になります' },
  { id: 'personal', label: '個人', description: '自分だけの支出です' },
];


// 同じ日付・金額なら同じ支払いとみなす（店名は読み取りで表記が揺れるので見ない）
const sameKey = (e: { purchase_date?: string; date?: string; amount: number }) => `${e.purchase_date ?? e.date}_${e.amount}`;

// ?to=personal で開くと登録先が最初から「個人」になる（個人タブからの入口）。
// useSearchParams を使う部分は Suspense で包む必要がある（Next.js の静的生成のため）
export default function ImportPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50"></div>}>
      <ImportPage />
    </Suspense>
  );
}

function ImportPage() {
  const { isDemoMode, myUserId, myUserName } = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  const [destination, setDestination] = useState<Destination>(searchParams.get('to') === 'personal' ? 'personal' : 'shared');
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });

  // 登録先にすでにある記録と照らし合わせて「登録済みかも」を付け直す
  const markDuplicates = async (list: Row[], dest: Destination): Promise<Row[]> => {
    if (list.length === 0 || isDemoMode) return list;
    const dates = list.map((r) => r.date).sort();
    const query = dest === 'personal'
      ? supabase.from('personal_expenses').select('purchase_date, amount').eq('owner', myUserId)
      : supabase.from('expenses').select('purchase_date, amount');
    const { data, error } = await query.gte('purchase_date', dates[0]).lte('purchase_date', dates[dates.length - 1]);
    if (error) { console.error(error); return list; }
    const existing = new Set((data || []).map(sameKey));
    return list.map((r) => {
      const duplicate = existing.has(sameKey(r));
      return { ...r, duplicate, checked: duplicate ? false : r.checked };
    });
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setFailedCount(0);
    setProgress({ done: 0, total: files.length });

    const today = todayYMD();
    const found: Row[] = [];
    const seenInOtherShots = new Set(rows.map(sameKey));
    let failed = 0;

    // 1枚ずつ順番に読む（同時に投げると AI の無料枠の制限にかかりやすい）
    for (const [index, file] of files.entries()) {
      try {
        const items = await scanHistory(file, today);
        const keysInThisShot = new Set<string>();
        for (const item of items) {
          const key = sameKey(item);
          // 続けて撮ったスクショは端が重なりやすいので、別の画像に同じ支払いがあれば重複の可能性として外しておく
          const overlaps = seenInOtherShots.has(key);
          keysInThisShot.add(key);
          found.push({ ...item, key: `${Date.now()}-${index}-${found.length}`, category: normalizeCategory(item.category), checked: !overlaps && item.kind !== 'transfer', duplicate: false, overlap: overlaps });
        }
        keysInThisShot.forEach((k) => seenInOtherShots.add(k));
      } catch (err) {
        console.error('History scan error:', err);
        failed += 1;
      }
      setProgress({ done: index + 1, total: files.length });
    }

    const merged = await markDuplicates([...rows, ...found], destination);
    // 新しい日付が上
    setRows(merged.sort((a, b) => b.date.localeCompare(a.date)));
    setFailedCount(failed);
    setProgress(null);
  };

  const changeDestination = async (dest: Destination) => {
    setDestination(dest);
    const remapped = rows.map((r) => ({ ...r, duplicate: false, checked: !r.overlap && r.kind !== 'transfer' }));
    setRows(await markDuplicates(remapped, dest));
  };

  const updateRow = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const selected = rows.filter((r) => r.checked);
  const selectedTotal = selected.reduce((sum, r) => sum + r.amount, 0);

  const handleRegister = async () => {
    if (selected.length === 0) return;
    const invalid = selected.find((r) => !r.store_name.trim() || !(r.amount > 0) || !r.date);
    if (invalid) { alert('店名・金額・日付が空の行があります'); return; }
    if (isDemoMode) { alert('⚠️ DEMOモード中はこの操作はできません'); return; }

    setIsSaving(true);
    const base = selected.map((r) => ({ store_name: r.store_name.trim(), amount: r.amount, purchase_date: r.date, category: r.category }));
    const { error } = destination === 'personal'
      ? await supabase.from('personal_expenses').insert(base.map((r) => ({ ...r, owner: myUserId })))
      : await supabase.from('expenses').insert(base.map((r) => ({ ...r, paid_by: myUserId })));
    setIsSaving(false);

    if (error) { console.error(error); alert('登録に失敗しました'); return; }
    setRows((prev) => prev.filter((r) => !r.checked));
    setModal({
      isOpen: true,
      title: '登録しました ✨',
      message: `${selected.length}件（${selectedTotal.toLocaleString()}円）を「${DESTINATIONS.find((d) => d.id === destination)!.label}」に登録しました。`,
    });
  };

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <PageShell isDemoMode={isDemoMode} tone={destination === 'personal' ? 'personal' : 'daily'}>
      <Modal isOpen={modal.isOpen} onClose={() => setModal((m) => ({ ...m, isOpen: false }))} type="alert" title={modal.title} message={modal.message} onConfirm={() => {}} />

      <PageHeader title="履歴から取り込む" subtitle="ハーンPayなど決済アプリの利用履歴を、スクショから登録します" isDemoMode={isDemoMode} back={{ href: destination === 'personal' ? '/personal' : '/', label: destination === 'personal' ? '個人' : '記録' }} />

      <Card className="p-5 mb-6">
        <SectionTitle tone={destination === 'personal' ? 'personal' : 'daily'}>登録先</SectionTitle>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {DESTINATIONS.map((d) => (
            <ChoiceButton key={d.id} selected={destination === d.id} onClick={() => changeDestination(d.id)} className="py-2.5 px-2">
              <span className="block text-sm font-bold">{d.label}</span>
              <span className={`block text-[10px] ${destination === d.id ? 'text-white/70' : 'text-slate-400'}`}>{d.description}</span>
            </ChoiceButton>
          ))}
        </div>

        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ''; handleFiles(files); }} />
        <button onClick={() => inputRef.current?.click()} disabled={!!progress} className={`${buttonClass.secondary} w-full py-3.5 text-sm`}>
          {progress ? <><Loader2 size={16} className="animate-spin" /> 読み取り中… {progress.done}/{progress.total}枚</> : <><ImageUp size={16} /> スクリーンショットを選ぶ（複数可）</>}
        </button>
        <p className="flex items-start gap-1.5 text-[11px] text-slate-400 mt-3 leading-relaxed">
          <Smartphone size={13} className="shrink-0 mt-0.5" />
          ハーンPayアプリの「取引履歴」で「支出」タブを開いてスクショを撮ってください。入金・チャージは自動で除きます。
        </p>
        {failedCount > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 mt-2"><AlertTriangle size={13} /> {failedCount}枚は読み取れませんでした。もう一度お試しください</p>
        )}
      </Card>

      {rows.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3 mb-3 ml-1">
            <h3 className="font-black text-slate-800 whitespace-nowrap">読み取り結果 <span className="text-xs font-bold text-slate-400">{rows.length}件</span></h3>
            <button onClick={() => setRows((prev) => prev.map((r) => ({ ...r, checked: !prev.every((x) => x.checked) })))} className="text-[11px] font-bold text-slate-500 hover:text-slate-700 whitespace-nowrap">
              {rows.every((r) => r.checked) ? 'すべて外す' : 'すべて選ぶ'}
            </button>
          </div>

          <ul className="space-y-2 mb-6">
            {rows.map((r) => (
              <li key={r.key}>
                <Card className={`p-3 ${r.checked ? '' : 'opacity-60'}`}>
                  {/* 1段目: 選択・店名・金額 / 2段目: 日付・カテゴリ */}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={r.checked} onChange={(e) => updateRow(r.key, { checked: e.target.checked })} className="w-5 h-5 shrink-0 accent-slate-800" aria-label="登録する" />
                    <input value={r.store_name} onChange={(e) => updateRow(r.key, { store_name: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-200 focus:border-slate-300 focus:outline-none font-bold text-slate-800 text-sm bg-transparent" aria-label="店名" />
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">¥</span>
                      <input type="number" inputMode="numeric" value={r.amount || ''} onChange={(e) => updateRow(r.key, { amount: Number(e.target.value) })} className="w-full pl-5 pr-2 py-1.5 rounded-lg border border-slate-200 text-sm font-black text-slate-800 text-right tabular bg-white" aria-label="金額" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pl-7">
                    <input type="date" value={r.date} onChange={(e) => updateRow(r.key, { date: e.target.value })} className="w-[8.5rem] shrink-0 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white" aria-label="日付" />
                    <select value={r.category} onChange={(e) => updateRow(r.key, { category: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white" aria-label="カテゴリ">
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  {r.kind === 'transfer' && (
                    <p className="flex items-center gap-1 text-[10px] font-bold text-sky-600 mt-2 pl-7">
                      <Send size={11} /> 人への送付です。立替の精算などで送った分なら登録不要です
                    </p>
                  )}
                  {(r.duplicate || r.overlap) && (
                    <p className="flex items-center gap-1 text-[10px] font-bold text-amber-600 mt-2 pl-7">
                      <AlertTriangle size={11} /> {r.duplicate ? '同じ日付・金額の記録がすでにあります' : '別のスクショにも同じ支払いが写っています'}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          {/* 下のタブに重ならないよう、タブの上に固定する */}
          <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30">
            <button onClick={handleRegister} disabled={isSaving || selected.length === 0} className={`${buttonClass.primary} w-full py-4 text-base shadow-xl`}>
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check strokeWidth={3} size={20} />}
              {selected.length}件（¥{selectedTotal.toLocaleString()}）を登録
            </button>
          </div>
        </>
      )}

      {rows.length === 0 && !progress && (
        <p className="text-center text-xs text-slate-400">
          レシートを1枚ずつ登録する場合は <Link href="/" className="font-bold text-slate-600 underline underline-offset-2">記録</Link> から
        </p>
      )}
    </PageShell>
  );
}
