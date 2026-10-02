'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { supabase, signInWithGoogle, householdErrorMessage } from '../lib/supabase';
import { useSession, googleName } from '../lib/session';
import { AuthCard, GoogleButton } from '../components/AuthCard';
import { Field, inputClass, buttonClass } from '../components/ui';

// 招待リンク（/join?invite=XXXXXXXX）から開く画面。
// ?code= にしないのは、Google ログインから戻るときに Supabase が ?code= を付けて、ぶつかるため。
// ログインしていなければ Google ログインへ送り、戻ってきたらこの画面で参加する。
// useSearchParams を使う部分は Suspense で包む必要がある（Next.js の静的生成のため）
export default function JoinPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50"></div>}>
      <JoinPage />
    </Suspense>
  );
}

function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = (searchParams.get('invite') ?? '').toUpperCase();
  const { state, refresh, signOut } = useSession();

  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const spinner = <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  if (state.status === 'loading') return <AuthCard>{spinner}</AuthCard>;

  if (!code) {
    return (
      <AuthCard subtitle="招待リンクが正しくありません">
        <Link href="/login" className={`${buttonClass.secondary} w-full py-3 text-sm`}>ログイン画面へ</Link>
      </AuthCard>
    );
  }

  // すでにどこかの家計に入っている（1人が入れる家計は1つ）
  if (state.status === 'ready') {
    return (
      <AuthCard subtitle="すでに家計に参加しています">
        <p className="text-xs text-slate-500 text-center mb-4 leading-relaxed">別の家計に移るには、いまの家計を抜ける必要があります</p>
        <Link href="/" className={`${buttonClass.primary} w-full py-3 text-sm`}>ホームへ</Link>
      </AuthCard>
    );
  }

  if (state.status !== 'noHousehold') {
    return (
      <AuthCard subtitle="パートナーから招待が届いています">
        <GoogleButton onClick={() => signInWithGoogle(`/join?invite=${encodeURIComponent(code)}`)} label="Googleでログインして参加" />
        <p className="text-[11px] text-slate-400 text-center mt-3 leading-relaxed">ログインすると、ふたりの家計に参加できます</p>
      </AuthCard>
    );
  }

  const displayName = nameTouched ? name : googleName(state.user);

  const handleJoin = async () => {
    if (!displayName.trim()) { setError('表示名を入力してください'); return; }
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('join_household', { code, display_name: displayName.trim() });
    if (error) {
      console.error(error);
      setError(householdErrorMessage(error));
      setBusy(false);
      return;
    }
    await refresh();
    router.replace('/');
  };

  return (
    <AuthCard subtitle="パートナーの家計に参加します">
      <div className="space-y-5">
        <Field label="あなたの表示名（相手に見える名前）">
          <input value={displayName} onChange={(e) => { setNameTouched(true); setName(e.target.value); }} placeholder="例: はるや" className={inputClass} maxLength={20} />
        </Field>
        <button onClick={handleJoin} disabled={busy} className={`${buttonClass.primary} w-full py-3.5`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />} 参加する
        </button>
        {error && <p className="text-xs text-rose-500 font-bold text-center">{error}</p>}
        <button onClick={signOut} className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 py-1">
          {state.user.email} ではないアカウントを使う
        </button>
      </div>
    </AuthCard>
  );
}
