'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { signInWithGoogle } from '../lib/supabase';
import { useSession } from '../lib/session';
import { AuthCard, GoogleButton } from '../components/AuthCard';

// Google から戻ってきたときのエラーは ?error_description= で届く。
// useSearchParams を使う部分は Suspense で包む必要がある（Next.js の静的生成のため）
export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50"></div>}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, startDemo } = useSession();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState(searchParams.get('error_description') ? 'ログインできませんでした。もう一度お試しください' : '');

  // ログイン済みなら、世帯の有無で行き先を分ける
  useEffect(() => {
    if (state.status === 'ready') router.replace('/');
    else if (state.status === 'noHousehold') router.replace('/welcome');
  }, [state.status, router]);

  const handleGoogle = async () => {
    setIsRedirecting(true);
    setError('');
    const { error } = await signInWithGoogle('/login');
    if (error) {
      console.error(error);
      setError('ログインを始められませんでした。もう一度お試しください');
      setIsRedirecting(false);
    }
  };

  const handleDemo = () => {
    startDemo();
    // デモで見せたいのは精算画面なので、直接精算ページへ
    router.push('/settlement');
  };

  const isBusy = state.status === 'loading' || state.status === 'ready' || state.status === 'noHousehold';

  return (
    <AuthCard subtitle="ふたりの家計・旅行・個人の記録">
      {isBusy ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
      ) : (
        <div className="animate-in fade-in zoom-in duration-300">
          <GoogleButton onClick={handleGoogle} loading={isRedirecting} />
          {error && <p className="text-xs text-rose-500 font-bold text-center mt-3">{error}</p>}
          <p className="text-[11px] text-slate-400 text-center mt-3 leading-relaxed">
            はじめての方もこちらから。ログインしたあと、<br />パートナーを招待できます
          </p>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <span className="relative bg-white/80 px-4 text-xs font-bold text-slate-400">または</span>
          </div>

          <button onClick={handleDemo} className="w-full bg-orange-50 text-orange-600 border border-orange-100 font-bold py-3.5 rounded-2xl hover:bg-orange-100 transition-all active:scale-95 flex items-center justify-center gap-2">
            <Sparkles size={18} /> DEMOモードで体験
          </button>
        </div>
      )}
    </AuthCard>
  );
}
