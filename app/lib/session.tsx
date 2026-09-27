'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// ログインの状態と、自分の世帯のメンバーを画面全体で共有する。
// 画面を移るたびに読み直すとちらつくので、ルートの layout で1回だけ読む

export type Member = { id: string; name: string };

export type SessionState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'demo' }
  | { status: 'signedOut' }
  | { status: 'noHousehold'; user: User }
  | { status: 'ready'; user: User; householdId: string; members: Member[] };

type SessionContextValue = {
  state: SessionState;
  refresh: () => Promise<void>;
  startDemo: () => void;
  signOut: () => Promise<void>;
};

const DEMO_KEY = 'kurasel_mode';

const readDemo = () => {
  try { return localStorage.getItem(DEMO_KEY) === 'demo'; } catch { return false; }
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  // 読み込みが重なったときに、古い結果で上書きしないための番号
  const loadId = useRef(0);

  const load = useCallback(async (session: Session | null) => {
    const id = ++loadId.current;
    if (!session) {
      setState(readDemo() ? { status: 'demo' } : { status: 'signedOut' });
      return;
    }
    // ログインしたらデモは終わり
    try { localStorage.removeItem(DEMO_KEY); } catch {}

    // RLS で自分の世帯のメンバーだけが返る。世帯がなければ空
    const { data, error } = await supabase.from('household_members').select('user_id, display_name, household_id').order('joined_at');
    if (id !== loadId.current) return;
    if (error) {
      console.error(error);
      setState({ status: 'error' });
      return;
    }
    const me = data.find((m) => m.user_id === session.user.id);
    setState(me
      ? { status: 'ready', user: session.user, householdId: me.household_id, members: data.map((m) => ({ id: m.user_id, name: m.display_name })) }
      : { status: 'noHousehold', user: session.user });
  }, []);

  useEffect(() => {
    // 登録した直後に今のログイン状態（INITIAL_SESSION）が届く。
    // この中で Supabase を待つと固まることがあるので、読み込みは次の周回で行う
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      setTimeout(() => load(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
  }, [load]);

  const startDemo = useCallback(() => {
    try { localStorage.setItem(DEMO_KEY, 'demo'); } catch {}
    setState({ status: 'demo' });
  }, []);

  const signOut = useCallback(async () => {
    try { localStorage.removeItem(DEMO_KEY); } catch {}
    await supabase.auth.signOut();
    setState({ status: 'signedOut' });
  }, []);

  return (
    <SessionContext.Provider value={{ state, refresh, startDemo, signOut }}>
      {state.status === 'error' ? (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm font-bold text-slate-500">読み込みに失敗しました。通信状況を確認してください</p>
          <button onClick={refresh} className="px-5 py-2.5 rounded-2xl bg-slate-800 text-white text-sm font-bold">もう一度読み込む</button>
        </div>
      ) : children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider の中で使ってください');
  return value;
}

// Google アカウントの名前（表示名の初期値に使う）
export const googleName = (user: User) =>
  String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '');
