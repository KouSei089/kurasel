'use client';
import { Card } from '../components/ui';
import { findCategory, isFixedCost } from '../lib/categories';
import { Entry, myShare } from '../lib/analytics';
import { CHART_COLORS } from './MonthChart';

// 固定費と変動費（自分の分）。固定費は家賃・光熱費・通信費・サブスク・保険・税金など、毎月ほぼ決まって出ていくお金。
// 見直しやすいのは変動費なので、変動費だけを支出の色で目立たせ、固定費は灰色にする（1色＋灰色の強調表示。
// 灰色は色の見分けに頼らないよう、凡例と金額の一覧を必ず並べる）
export const FIXED_COLOR = '#64748b';

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

export const splitFixedCosts = (entries: Entry[], myUserId: string) => {
  const isFixed = (e: Entry) => isFixedCost(e.category, e.from_subscription);
  const fixed = entries.filter(isFixed).reduce((sum, e) => sum + myShare(e, myUserId), 0);
  const variable = entries.filter((e) => !isFixed(e)).reduce((sum, e) => sum + myShare(e, myUserId), 0);
  // 固定費の中身（小分類ごと。サブスクから記録したものは「サブスク」にまとめる）
  const byLabel = new Map<string, { icon: string; value: number }>();
  for (const e of entries.filter(isFixed)) {
    const cat = findCategory(e.category);
    const key = e.from_subscription && !cat.fixed ? 'サブスク' : cat.label;
    const icon = e.from_subscription && !cat.fixed ? '🔁' : cat.icon;
    const cur = byLabel.get(key) ?? { icon, value: 0 };
    byLabel.set(key, { icon, value: cur.value + myShare(e, myUserId) });
  }
  const breakdown = [...byLabel.entries()].map(([label, v]) => ({ label, ...v })).filter((b) => b.value > 0).sort((a, b) => b.value - a.value);
  return { fixed, variable, breakdown };
};

export function FixedCostCard({ entries, myUserId, monthCount }: {
  entries: Entry[]; // 期間内の支出
  myUserId: string;
  monthCount: number; // 期間の月数（2か月以上なら月あたりも出す）
}) {
  const { fixed, variable, breakdown } = splitFixedCosts(entries, myUserId);
  const total = fixed + variable;
  if (total === 0) return null;

  const rows = [
    { key: 'fixed', label: '固定費', value: fixed, color: FIXED_COLOR },
    { key: 'variable', label: '変動費', value: variable, color: CHART_COLORS.expense },
  ];

  return (
    <Card className="p-5 mb-6">
      <h3 className="font-black text-sm text-slate-800">固定費と変動費</h3>
      <p className="text-[10px] text-slate-400 mb-3">固定費は家賃・光熱費・通信費・サブスク・保険・税金など、毎月ほぼ決まって出ていくお金</p>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 gap-0.5 mb-3" role="img" aria-label="固定費と変動費の割合">
        {rows.filter((r) => r.value > 0).map((r) => (
          <span key={r.key} title={`${r.label} ${yen(r.value)}`} style={{ width: `${(r.value / total) * 100}%`, backgroundColor: r.color }} />
        ))}
      </div>
      <ul className="space-y-1.5 mb-3">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 text-xs">
            <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ backgroundColor: r.color }} />
            <span className="flex-1 font-bold text-slate-500">{r.label}</span>
            <span className="text-slate-400 tabular">{Math.round((r.value / total) * 100)}%</span>
            <span className="w-20 text-right font-bold text-slate-700 tabular">{yen(r.value)}</span>
          </li>
        ))}
      </ul>
      {monthCount > 1 && (
        <p className="text-[11px] font-bold text-slate-500 mb-3">月あたり 固定費 <span className="text-slate-800">{yen(fixed / monthCount)}</span> ・ 変動費 <span className="text-slate-800">{yen(variable / monthCount)}</span></p>
      )}
      {breakdown.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 mb-1.5">固定費の内訳</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {breakdown.map((b) => (
              <li key={b.label} className="flex items-center justify-between text-[11px] min-w-0">
                <span className="text-slate-500 truncate">{b.icon} {b.label}</span>
                <span className="font-bold text-slate-700 tabular shrink-0 ml-1">{yen(b.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
