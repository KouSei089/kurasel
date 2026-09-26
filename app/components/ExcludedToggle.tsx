'use client';
import { Gift } from 'lucide-react';
import { Toggle } from './ui';

// 「おごり（精算対象外）」の切り替え。日常と旅行の入力フォームで共通
export default function ExcludedToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${value ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
      <span className="flex items-center gap-3 text-left">
        <span className={`hidden min-[360px]:block p-2 rounded-full ${value ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}><Gift size={16} /></span>
        <span>
          <span className="block text-sm font-bold text-slate-700">おごり（精算しない）</span>
          <span className="block text-[10px] text-slate-400">記録は残し、割り勘の計算からは外します</span>
        </span>
      </span>
      <Toggle checked={value} tone="amber" />
    </button>
  );
}

// 履歴の各行に出す「おごり」の印。onClick があれば押して切り替えられる。
// 誰のおごりかは同じ行の「支払った人」で分かるので、ラベルは短く「おごり」だけにしている
// （幅の狭い iPhone でも1行に収まるように）
export function ExcludedChip({ excluded, onClick }: { excluded: boolean; onClick?: () => void }) {
  const action = excluded ? 'おごりを取り消す' : 'おごりにする';
  const className = `inline-flex items-center gap-1 whitespace-nowrap shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${excluded ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-200'}`;
  const content = <><Gift size={13} /> おごり</>;
  return onClick
    ? <button type="button" onClick={onClick} className={className} aria-label={action} title={action}>{content}</button>
    : excluded ? <span className={className}>{content}</span> : null;
}
