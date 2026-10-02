'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, type Member } from './session';

// デモの見本データは名前をそのまま持っているので、デモでは名前をIDとして使う
const DEMO_MEMBERS: Member[] = [{ id: 'あなた', name: 'あなた' }, { id: 'パートナー', name: 'パートナー' }];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 各画面で「自分は誰か」を知るためのフック。
// ログインしていなければログイン画面へ、世帯がなければ「はじめる」画面へ移す。
// 準備ができるまで myUserId・myUserName は空文字
export function useCurrentUser() {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'signedOut') router.replace('/login');
    else if (state.status === 'noHousehold') router.replace('/welcome');
  }, [state.status, router]);

  const isDemoMode = state.status === 'demo';
  const members = isDemoMode ? DEMO_MEMBERS : state.status === 'ready' ? state.members : [];
  const myUserId = isDemoMode ? DEMO_MEMBERS[0].id : state.status === 'ready' ? state.user.id : '';
  const me = members.find((m) => m.id === myUserId);

  // 記録に入っているID（paid_by・コメント・リアクション）を表示名にする。
  // 以前のデータを引き継ぐ前は名前が入っているので、そのまま出す
  const nameOf = (id: string | null | undefined) => {
    if (!id) return '';
    return members.find((m) => m.id === id)?.name ?? (UUID.test(id) ? '不明' : id);
  };

  return {
    isDemoMode,
    myUserId,
    myUserName: me?.name ?? '',
    householdId: state.status === 'ready' ? state.householdId : '',
    members,
    partner: members.find((m) => m.id !== myUserId) ?? null,
    nameOf,
  };
}
