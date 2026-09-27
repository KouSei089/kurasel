'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, KeyRound, Loader2 } from 'lucide-react';
import { supabase, householdErrorMessage } from '../lib/supabase';
import { useSession, googleName } from '../lib/session';
import { AuthCard } from '../components/AuthCard';
import { Field, inputClass, buttonClass } from '../components/ui';

// ログインしたが、まだどの世帯（ふたりの家計）にも入っていない人の最初の画面。
// 自分で世帯を作るか、相手から届いた招待コードで入る

export default function WelcomePage() {
  const router = useRouter();
  const { state, refresh, signOut } = useSession();

  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (state.status === 'signedOut') router.replace('/login');
    else if (state.status === 'ready' || state.status === 'demo') router.replace('/');
  }, [state.status, router]);

  if (state.status !== 'noHousehold') {
    return <AuthCard><div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={32} /></div></AuthCard>;
  }

  // 入力するまでは Google アカウントの名前を出しておく
  const displayName = nameTouched ? name : googleName(state.user);

  const run = async (kind: 'create' | 'join') => {
    if (!displayName.trim()) { setError('表示名を入力してください'); return; }
    if (kind === 'join' && !code.trim()) { setError('招待コードを入力してください'); return; }
    setBusy(kind);
    setError('');
    const { error } = kind === 'create'
      ? await supabase.rpc('create_household', { display_name: displayName.trim() })
      : await supabase.rpc('join_household', { code: code.trim(), display_name: displayName.trim() });
    if (error) {
      console.error(error);
      setError(householdErrorMessage(error));
      setBusy(null);
      return;
    }
    await refresh();
    // 作った人はそのまま相手を招待できるように、メンバーの画面へ
    router.replace(kind === 'create' ? '/household' : '/');
  };

  return (
    <AuthCard subtitle="ようこそ！はじめに家計を用意します">
      <div className="space-y-5 animate-in fade-in duration-300">
        <Field label="あなたの表示名（相手に見える名前）">
          <input value={displayName} onChange={(e) => { setNameTouched(true); setName(e.target.value); }} placeholder="例: はるや" className={inputClass} maxLength={20} />
        </Field>

        <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
          <p className="text-sm font-black text-slate-700 mb-1">はじめて使う</p>
          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">ふたりの家計を作ります。あとからパートナーを招待できます。ひとりでも使えます</p>
          <button onClick={() => run('create')} disabled={!!busy} className={`${buttonClass.primary} w-full py-3 text-sm`}>
            {busy === 'create' ? <Loader2 size={16} className="animate-spin" /> : <Home size={16} />} ふたりの家計をはじめる
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
          <p className="text-sm font-black text-slate-700 mb-1">招待されている</p>
          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">パートナーから届いた招待コード（8文字）を入力してください</p>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD2345" autoCapitalize="characters" autoComplete="off" className={`${inputClass} !py-2.5 flex-1 min-w-0 tracking-widest font-black`} maxLength={8} />
            <button onClick={() => run('join')} disabled={!!busy} className={`${buttonClass.secondary} px-4 text-sm shrink-0`}>
              {busy === 'join' ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} 参加
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-rose-500 font-bold text-center">{error}</p>}

        <button onClick={signOut} className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 py-1">
          {state.user.email} からログアウト
        </button>
      </div>
    </AuthCard>
  );
}
