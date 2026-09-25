'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

// ログイン情報は localStorage にしかないので、サーバー側の描画では「未確定」として扱う。
// useEffect で読み込んで setState すると描画が1往復増えるため useSyncExternalStore で読む。
const subscribe = () => () => {};
const read = (key: string) => () => localStorage.getItem(key);
const readOnServer = () => null;

export function useCurrentUser() {
  const router = useRouter();
  const isReady = useSyncExternalStore(subscribe, () => true, () => false);
  const mode = useSyncExternalStore(subscribe, read('kurasel_mode'), readOnServer);
  const storedName = useSyncExternalStore(subscribe, read('scan_io_user_name'), readOnServer);

  const isDemoMode = mode === 'demo';
  // デモの場合は強制的に「あなた」
  const myUserName = isDemoMode ? 'あなた' : storedName ?? '';

  useEffect(() => {
    if (isReady && !isDemoMode && !storedName) router.push('/login');
  }, [isReady, isDemoMode, storedName, router]);

  return { isDemoMode, myUserName };
}
