'use client';
import { Pencil, Target } from 'lucide-react';
import { Card } from './ui';
import { budgetStatus } from '../lib/trips';

// 旅行の予算（目標利用金額）の表示。8割を超えたらアンバー、超えたらローズ
const levelColor = {
  ok: { bar: 'bg-sky-400', text: 'text-sky-600' },
  warn: { bar: 'bg-amber-400', text: 'text-amber-600' },
  over: { bar: 'bg-rose-500', text: 'text-rose-600' },
} as const;

export function BudgetBar({ budget, spent, className = '' }: { budget: number; spent: number; className?: string }) {
  const { ratio, level } = budgetStatus(budget, spent);
  return (
    <div className={`h-1.5 rounded-full bg-slate-100 overflow-hidden ${className}`} role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="予算の消化率">
      <div className={`h-full rounded-full transition-all ${levelColor[level].bar}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </div>
  );
}

export function BudgetCard({ budget, spent, days, onEdit }: { budget: number | null; spent: number; days: number | null; onEdit: () => void }) {
  if (budget === null) {
    return (
      <button onClick={onEdit} className="w-full mb-6 flex items-center gap-3 p-4 rounded-3xl border-2 border-dashed border-sky-200 bg-white/50 text-left hover:bg-white transition-colors">
        <span className="p-2 rounded-full bg-sky-50 text-sky-500 shrink-0"><Target size={18} /></span>
        <span>
          <span className="block text-sm font-bold text-slate-700">予算を設定する</span>
          <span className="block text-[11px] text-slate-400">目標の金額を決めて、使いすぎを防げます</span>
        </span>
      </button>
    );
  }

  const { ratio, remaining, level } = budgetStatus(budget, spent);
  const color = levelColor[level];
  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5 whitespace-nowrap"><Target size={15} className="text-sky-500" /> 予算</h3>
        <button onClick={onEdit} className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 whitespace-nowrap"><Pencil size={12} /> 変更</button>
      </div>

      <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
        <p className="font-black text-slate-800 tabular whitespace-nowrap">
          <span className="text-2xl">¥{spent.toLocaleString()}</span>
          <span className="text-xs font-bold text-slate-400"> / ¥{budget.toLocaleString()}</span>
        </p>
        <span className={`text-sm font-black tabular ${color.text}`}>{Math.round(ratio * 100)}%</span>
      </div>
      <BudgetBar budget={budget} spent={spent} className="!h-2.5 mb-3" />

      <div className="flex items-center justify-between gap-2 text-xs font-bold flex-wrap">
        {remaining >= 0 ? (
          <span className="text-slate-500">残り <span className={`tabular ${color.text}`}>¥{remaining.toLocaleString()}</span></span>
        ) : (
          <span className="text-rose-600">¥{Math.abs(remaining).toLocaleString()} 超過しています</span>
        )}
        {days !== null && remaining > 0 && (
          <span className="text-slate-400 whitespace-nowrap">1日あたり <span className="tabular text-slate-600">¥{Math.floor(remaining / days).toLocaleString()}</span>（{days}日）</span>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mt-2">おごり・精算済みも含めた、この旅行の支出の合計です</p>
    </Card>
  );
}
