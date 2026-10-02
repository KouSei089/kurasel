'use client';
import Link from 'next/link';
import { AlertTriangle, Pencil, Target } from 'lucide-react';
import { Card } from './ui';
import { BudgetBar } from './BudgetCard';
import type { BudgetProgressRow, BudgetScope } from '../lib/budgets';

// 月の予算の進み具合（精算画面・個人画面）。8割を超えたらアンバー、超えたらローズ。
// 状態は色だけでなく「あと¥」「¥超過」の文字とアイコンでも出す
const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

export function MonthlyBudget({ rows, scope, monthLabel }: { rows: BudgetProgressRow[]; scope: BudgetScope; monthLabel: string }) {
  const href = scope === 'personal' ? '/budget?scope=personal' : '/budget';

  if (rows.length === 0) {
    return (
      <Link href={href} className="mb-6 flex items-center gap-3 p-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 hover:bg-white transition-colors">
        <span className="p-2 rounded-full bg-slate-100 text-slate-500 shrink-0"><Target size={18} /></span>
        <span>
          <span className="block text-sm font-bold text-slate-700">月の予算を決める</span>
          <span className="block text-[11px] text-slate-400">食費など分類ごとに決めると、使いすぎにすぐ気づけます</span>
        </span>
      </Link>
    );
  }

  const overCount = rows.filter((r) => r.level === 'over').length;

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5 whitespace-nowrap"><Target size={15} className="text-slate-500" /> {monthLabel}の予算</h3>
        <Link href={href} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 whitespace-nowrap"><Pencil size={12} /> 変更</Link>
      </div>
      {overCount > 0 && (
        <p className="flex items-center gap-1 text-[11px] font-bold text-rose-600 mb-3"><AlertTriangle size={12} /> {overCount}つの予算を超えています</p>
      )}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
              <span className="font-bold text-slate-600 truncate">{r.icon} {r.label}</span>
              <span className="tabular shrink-0"><span className="font-black text-slate-800">{yen(r.spent)}</span><span className="text-slate-400"> / {yen(r.budget)}</span></span>
            </div>
            <BudgetBar budget={r.budget} spent={r.spent} className={r.id === 'total' ? '!h-2.5' : ''} />
            <p className={`text-[10px] font-bold mt-0.5 text-right tabular ${r.level === 'over' ? 'text-rose-600' : r.level === 'warn' ? 'text-amber-600' : 'text-slate-400'}`}>
              {r.remaining >= 0 ? `あと ${yen(r.remaining)}（${Math.round(r.ratio * 100)}%）` : `${yen(-r.remaining)} 超過`}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
