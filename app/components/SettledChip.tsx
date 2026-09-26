'use client';
import { CheckCheck } from 'lucide-react';

// 履歴の各行に出す「精算済み」の印。押すと切り替わる。日常と旅行で共通。
// 幅の狭い iPhone（拡大表示で320pt）でも1行に収まるよう、ラベルは状態だけの短い言葉にしている
export default function SettledChip({ settled, onClick }: { settled: boolean; onClick: () => void }) {
  const action = settled ? '精算済みを取り消す' : '精算済みにする';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={action}
      title={action}
      className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${settled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200'}`}
    >
      <CheckCheck size={13} strokeWidth={2.5} />
      {settled ? '精算済み' : '未精算'}
    </button>
  );
}
