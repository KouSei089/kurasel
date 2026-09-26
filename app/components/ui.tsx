'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ScanLine, Wallet, Plane, UserRound, ArrowLeft, CheckCircle2, Clock, Send, X, Lock, ChevronDown, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import type { Category } from '../lib/categories';

// 画面をまたいで使う見た目の部品。色・角丸・余白はここでそろえる。
//   日常 = ネイビー(slate-800) / 旅行 = スカイ(sky-500) / 個人 = バイオレット(violet-500) / おごり = アンバー

export type Tone = 'daily' | 'trip' | 'personal';

const toneAccent: Record<Tone, string> = {
  daily: 'bg-slate-800',
  trip: 'bg-sky-500',
  personal: 'bg-violet-500',
};

const toneBackground: Record<Tone, string> = {
  daily: 'bg-gradient-to-b from-slate-50 to-slate-100',
  trip: 'bg-gradient-to-b from-sky-50 to-slate-100',
  personal: 'bg-gradient-to-b from-violet-50 to-slate-100',
};

// ---------- 画面の枠 ----------

const NAV_ITEMS = [
  { href: '/', label: '記録', icon: ScanLine, match: (p: string) => p === '/', activeBg: 'bg-slate-100' },
  { href: '/settlement', label: '精算', icon: Wallet, match: (p: string) => p.startsWith('/settlement'), activeBg: 'bg-slate-100' },
  { href: '/trips', label: '旅行', icon: Plane, match: (p: string) => p.startsWith('/trips'), activeBg: 'bg-sky-100 text-sky-600' },
  { href: '/personal', label: '個人', icon: UserRound, match: (p: string) => p.startsWith('/personal'), activeBg: 'bg-violet-100 text-violet-600' },
];

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur-xl border-t border-slate-200/70 pb-[env(safe-area-inset-bottom)]">
      <ul className="max-w-md mx-auto grid grid-cols-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, match, activeBg }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-colors ${active ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className={`px-4 py-1 rounded-full transition-colors ${active ? activeBg : ''}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PageShell({ isDemoMode, tone = 'daily', nav = true, children }: { isDemoMode?: boolean; tone?: Tone; nav?: boolean; children: React.ReactNode }) {
  const bg = isDemoMode ? 'bg-gradient-to-b from-orange-50 to-slate-50' : toneBackground[tone];
  return (
    <div className={`min-h-screen text-slate-700 ${bg}`}>
      {isDemoMode && (
        <div className="fixed top-0 inset-x-0 z-50 bg-orange-400 text-white text-[11px] font-bold text-center pb-1 pt-[max(0.25rem,env(safe-area-inset-top))] shadow-sm">
          DEMO MODE - データは保存されません
        </div>
      )}
      {/* 上はノッチ、下はタブとホームバーの分を空ける */}
      <div className={`max-w-md mx-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] ${isDemoMode ? 'pt-[calc(2.5rem+env(safe-area-inset-top))]' : 'pt-[max(1.5rem,calc(0.75rem+env(safe-area-inset-top)))]'}`}>{children}</div>
      {nav && <BottomNav />}
    </div>
  );
}

export function PageHeader({ title, subtitle, isDemoMode, back, actions }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  isDemoMode?: boolean;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 mb-3 -ml-1 px-1 py-1">
          <ArrowLeft size={14} /> {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-tight break-words flex items-center gap-2 flex-wrap">
            {title}
            {isDemoMode && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200 tracking-normal">DEMO</span>}
          </h1>
          {subtitle && <p className="text-xs font-bold text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

// 月ごとに見る画面（精算・個人）の月の切り替え
export function MonthSwitcher({ month, onChange }: { month: Date; onChange: (month: Date) => void }) {
  const move = (diff: number) => onChange(new Date(month.getFullYear(), month.getMonth() + diff, 1));
  return (
    <Card className="flex items-center justify-between p-1.5 mb-6">
      <button onClick={() => move(-1)} className="p-3 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition" aria-label="前の月"><ChevronLeft size={20} /></button>
      <span className="font-black text-lg text-slate-800 tabular">{month.getFullYear()}年{month.getMonth() + 1}月</span>
      <button onClick={() => move(1)} className="p-3 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition" aria-label="次の月"><ChevronRight size={20} /></button>
    </Card>
  );
}

// ---------- カード・見出し ----------

export function Card({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white/80 backdrop-blur-xl rounded-3xl border border-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ tone = 'daily', children, right }: { tone?: Tone; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
        <span className={`w-1.5 h-5 rounded-full ${toneAccent[tone]}`}></span>
        {children}
      </h2>
      {right}
    </div>
  );
}

// ---------- ボタン・入力 ----------

const buttonBase = 'inline-flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

export const buttonClass = {
  primary: `${buttonBase} bg-slate-800 text-white rounded-2xl shadow-lg shadow-slate-800/15 hover:bg-slate-700`,
  secondary: `${buttonBase} bg-white text-slate-600 border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50`,
  icon: 'p-1.5 rounded-full text-slate-400 hover:bg-white hover:text-slate-700 transition-colors',
};

export const inputClass = 'w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-bold text-slate-700 placeholder:text-slate-300 shadow-sm transition focus:outline-none focus:ring-4 focus:ring-slate-200/70 focus:border-slate-300';

export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">{label}</span>
      {children}
    </label>
  );
}

// 複数の中から1つ選ぶボタン群（カテゴリ・支払った人など）
export function ChoiceButton({ selected, onClick, children, className = '' }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border transition-all active:scale-95 ${selected ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'} ${className}`}>
      {children}
    </button>
  );
}

export function CategoryPicker({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (id: string) => void }) {
  return (
    // 6つ並ぶと拡大表示の iPhone(320pt) では文字が収まらないので、狭い幅では3列×2段にする
    <div className={`grid gap-1.5 ${categories.length > 5 ? 'grid-cols-3 min-[360px]:grid-cols-6' : 'grid-cols-5'}`}>
      {categories.map((cat) => (
        <ChoiceButton key={cat.id} selected={value === cat.id} onClick={() => onChange(cat.id)} className="flex flex-col items-center py-2">
          <span className="text-lg leading-none mb-1">{cat.icon}</span>
          <span className="text-[10px] font-bold whitespace-nowrap">{cat.label}</span>
        </ChoiceButton>
      ))}
    </div>
  );
}

export function Toggle({ checked, tone = 'slate' }: { checked: boolean; tone?: 'slate' | 'amber' }) {
  const on = tone === 'amber' ? 'bg-amber-500' : 'bg-slate-800';
  return (
    <span className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${checked ? on : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </span>
  );
}

// ---------- 空状態・読み込み ----------

export function EmptyState({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <Card className="text-center py-12 px-6">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-sm font-bold text-slate-500">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
    </Card>
  );
}

export function Loading() {
  return (
    <div className="space-y-3" aria-label="読み込み中">
      {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-3xl bg-white/60 animate-pulse" />)}
    </div>
  );
}

// ---------- 精算 ----------

type DetailRow = { label: string; value: number; highlight?: boolean; signed?: boolean };

// 日常の月次精算と旅行の精算で共通の「いくら払う/もらう」カード
export function SettlementCard({ balance, isPaid, isReceived, isDemoMode, caption, rows, notes, zeroLabel = '精算なし', onStatusClick }: {
  balance: number;
  isPaid: boolean;
  isReceived: boolean;
  isDemoMode?: boolean;
  caption: string;
  rows: DetailRow[];
  notes?: React.ReactNode;
  zeroLabel?: string; // 差額0のときの見出し（全部精算済みなら「精算済み」など）
  onStatusClick: (type: 'paid' | 'received') => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const isPayer = balance < 0;
  const isReceiver = balance > 0;

  const bg = isReceived
    ? 'from-emerald-500 to-teal-600 shadow-emerald-600/20'
    : balance === 0 ? 'from-slate-400 to-slate-500 shadow-slate-500/20'
    : isReceiver ? 'from-slate-700 to-slate-800 shadow-slate-800/25'
    : 'from-rose-400 to-rose-500 shadow-rose-500/25';

  return (
    <div className={`relative overflow-hidden rounded-3xl p-6 text-white bg-gradient-to-br shadow-xl mb-6 ${bg}`}>
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 pointer-events-none"></div>

      <p className="relative text-xs font-bold text-white/80 text-center mb-2">{caption}</p>
      <h2 className="relative text-center font-black leading-tight mb-5">
        {balance === 0 ? (
          <span className="text-3xl">{zeroLabel}</span>
        ) : (
          <>
            <span className="block text-sm font-bold text-white/85 mb-1">相手{isReceiver ? 'から' : 'へ'}</span>
            <span className="text-4xl tabular tracking-tight">{Math.abs(balance).toLocaleString()}</span>
            <span className="text-lg ml-1">円{isReceiver ? 'もらう' : '払う'}</span>
          </>
        )}
      </h2>

      <div className="relative flex flex-col items-center gap-2 mb-5">
        {isReceived ? (
          <div className="flex items-center gap-2 bg-white/20 pl-4 pr-2 py-1.5 rounded-full">
            <CheckCircle2 size={18} />
            <span className="font-bold text-sm">精算完了</span>
            {isReceiver ? (
              <button onClick={() => onStatusClick('received')} className="ml-1 bg-white/20 p-1 rounded-full hover:bg-white/30" aria-label="精算完了を取り消す">
                {isDemoMode ? <Lock size={14} /> : <X size={14} />}
              </button>
            ) : <span className="w-1" />}
          </div>
        ) : isPayer ? (
          <button onClick={() => onStatusClick('paid')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 ${isPaid ? 'bg-white/20 text-white' : 'bg-white text-rose-500 shadow-lg'}`}>
            {isPaid ? <><Clock size={16} /> 支払い報告済み</> : <><Send size={16} /> 支払いを完了する</>}
          </button>
        ) : isReceiver ? (
          <>
            {isPaid && <span className="text-[11px] font-bold bg-white/20 px-3 py-1 rounded-full">相手が「支払い済み」にしました</span>}
            <button onClick={() => onStatusClick('received')} className="flex items-center gap-2 bg-white text-slate-700 px-5 py-2.5 rounded-full shadow-lg font-bold text-sm transition-all active:scale-95">
              <CheckCircle2 size={16} className="text-emerald-500" /> 受け取り完了
            </button>
          </>
        ) : null}
      </div>

      <div className="relative bg-black/15 rounded-2xl overflow-hidden">
        <button onClick={() => setShowDetails(!showDetails)} className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-2"><HelpCircle size={14} /> 計算の内訳</span>
          <ChevronDown size={14} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>
        {showDetails && (
          <div className="px-4 pb-4 text-xs">
            {rows.map((row) => (
              <div key={row.label} className={`flex justify-between py-1.5 border-t border-white/10 ${row.highlight ? 'font-black' : 'text-white/85'}`}>
                <span>{row.label}</span>
                <span className="tabular">{row.signed && row.value > 0 ? '+' : ''}{row.value.toLocaleString()} 円</span>
              </div>
            ))}
            {notes && <div className="pt-2 text-[10px] text-center text-white/75 space-y-0.5">{notes}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- カテゴリ別集計 ----------

export function CategoryBreakdown({ title, items }: { title: string; items: (Category & { value: number })[] }) {
  const total = items.reduce((sum, c) => sum + c.value, 0);
  if (total === 0) return null;
  return (
    <Card className="p-5 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-black text-sm text-slate-800">{title}</h3>
        <span className="text-sm font-black text-slate-700 tabular">¥{total.toLocaleString()}</span>
      </div>
      {/* 全体に占める割合を1本の帯で */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 mb-4 gap-0.5">
        {items.map((cat) => <span key={cat.id} className={cat.bar} style={{ width: `${(cat.value / total) * 100}%` }} />)}
      </div>
      <ul className="space-y-2">
        {items.map((cat) => (
          <li key={cat.id} className="flex items-center gap-3 text-xs">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cat.bar}`} />
            <span className="flex-1 font-bold text-slate-500">{cat.icon} {cat.label}</span>
            <span className="text-slate-400 tabular">{Math.round((cat.value / total) * 100)}%</span>
            <span className="w-20 text-right font-bold text-slate-700 tabular">¥{cat.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
