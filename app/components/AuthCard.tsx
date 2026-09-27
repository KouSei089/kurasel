'use client';
import { Loader2 } from 'lucide-react';

// ログイン・はじめる・招待から参加する画面で共通の枠（ロゴ入りのカード）

export function AuthCard({ subtitle, children }: { subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-gray-200 flex items-center justify-center p-4 relative overflow-hidden text-gray-800">
      {/* 背景の装飾 */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-slate-200/40 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white/40 w-full max-w-md relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/60 to-transparent pointer-events-none"></div>

        {/* ロゴブロック */}
        <div className="flex flex-col items-center justify-center mb-8 relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- 小さな固定のアイコン */}
          <img src="/icon-512.png" alt="暮らしと精算のアイコン" className="w-20 h-20 rounded-3xl shadow-lg mb-4 object-cover" />
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-1">暮らしと精算</h1>
          {subtitle && <p className="text-sm font-bold text-slate-400 tracking-wider text-center">{subtitle}</p>}
        </div>

        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}

export function GoogleButton({ onClick, loading, label = 'Googleでログイン' }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={loading} className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-60">
      {loading ? <Loader2 className="animate-spin" size={18} /> : (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
