'use client';
import { Gift } from 'lucide-react';

// 「おごり（精算対象外）」の切り替え。日常と旅行の入力フォームで共通
export default function ExcludedToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${value ? 'bg-amber-50 border-amber-200' : 'bg-white/60 border-slate-200/60 hover:bg-white'}`}>
      <span className="flex items-center gap-3 text-left">
        <span className={`p-2 rounded-full ${value ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}><Gift size={16} /></span>
        <span>
          <span className="block text-sm font-bold text-slate-700">おごり（精算しない）</span>
          <span className="block text-[10px] text-slate-400">記録は残し、割り勘の計算からは外します</span>
        </span>
      </span>
      <span className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${value ? 'bg-amber-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}
