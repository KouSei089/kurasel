'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Link2, Loader2, LogOut, Pencil, Share2, UserRound, X } from 'lucide-react';
import { supabase, householdErrorMessage } from '../lib/supabase';
import { useSession } from '../lib/session';
import { useCurrentUser } from '../lib/useCurrentUser';
import Modal from '../components/Modal';
import { PageShell, PageHeader, Card, SectionTitle, buttonClass, inputClass } from '../components/ui';

// ふたりの家計のメンバー。表示名の変更・パートナーの招待・ログアウト

export default function HouseholdPage() {
  const router = useRouter();
  const { refresh, signOut } = useSession();
  const { isDemoMode, myUserId, myUserName, members } = useCurrentUser();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const [invite, setInvite] = useState<{ code: string; url: string } | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // メンバーはアプリを開いたときに読んだまま。相手が参加したかを見に来る画面なので、開くたびに読み直す
  useEffect(() => {
    if (!isDemoMode) refresh();
  }, [isDemoMode, refresh]);

  const checkDemo = () => {
    if (isDemoMode) { alert('⚠️ DEMOモード中はこの操作はできません'); return true; }
    return false;
  };

  const handleSaveName = async () => {
    const name = nameDraft.trim();
    if (!name || name === myUserName) { setIsEditingName(false); return; }
    setIsSavingName(true);
    const { error } = await supabase.from('household_members').update({ display_name: name }).eq('user_id', myUserId);
    setIsSavingName(false);
    if (error) { console.error(error); alert('変更に失敗しました'); return; }
    setIsEditingName(false);
    await refresh();
  };

  const handleCreateInvite = async () => {
    if (checkDemo()) return;
    setIsCreatingInvite(true);
    setInviteError('');
    const { data, error } = await supabase.rpc('create_invite');
    setIsCreatingInvite(false);
    if (error || typeof data !== 'string') {
      console.error(error);
      setInviteError(householdErrorMessage(error));
      return;
    }
    setInvite({ code: data, url: `${window.location.origin}/join?invite=${data}` });
  };

  // スマホでは共有シート（LINE などに送れる）、使えなければコピー
  const handleShare = async () => {
    if (!invite) return;
    const text = `「暮らしと精算」でふたりの家計を一緒に使いましょう。\n招待コード: ${invite.code}（24時間有効）`;
    if (navigator.share) {
      // 共有シートを閉じただけでも例外になるので、何もしない
      try { await navigator.share({ title: '暮らしと精算への招待', text, url: invite.url }); } catch {}
      return;
    }
    handleCopy();
  };

  const handleCopy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`コピーできませんでした。次のリンクを送ってください\n${invite.url}`);
    }
  };

  const handleLogout = async () => {
    setIsLogoutOpen(false);
    await signOut();
    router.replace('/login');
  };

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  const canInvite = members.length < 2;

  return (
    <PageShell isDemoMode={isDemoMode}>
      <Modal isOpen={isLogoutOpen} onClose={() => setIsLogoutOpen(false)} type="confirm" title={isDemoMode ? 'デモを終わる' : 'ログアウト'} message={isDemoMode ? 'デモモードを終わって、ログイン画面に戻ります。' : '本当にログアウトしますか？'} confirmText={isDemoMode ? '終わる' : 'ログアウト'} onConfirm={handleLogout} />

      <PageHeader title="ふたりの家計" subtitle="メンバーと招待の設定" isDemoMode={isDemoMode} back={{ href: '/', label: '記録' }} />

      <Card className="p-5 mb-6">
        <SectionTitle>メンバー</SectionTitle>
        <ul className="space-y-2">
          {members.map((m) => {
            const isMe = m.id === myUserId;
            return (
              <li key={m.id} className="flex items-center gap-3 py-1.5">
                <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${isMe ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-500'}`}><UserRound size={18} /></span>
                {isMe && isEditingName ? (
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }} className={`${inputClass} !py-2 flex-1 min-w-0`} maxLength={20} autoFocus />
                    <button onClick={handleSaveName} disabled={isSavingName} className="p-2 bg-slate-800 text-white rounded-full shrink-0" aria-label="保存">{isSavingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>
                    <button onClick={() => setIsEditingName(false)} className="p-2 bg-slate-100 text-slate-500 rounded-full shrink-0" aria-label="やめる"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 font-bold text-slate-700 truncate">{m.name}{isMe && <span className="text-xs text-slate-400 ml-1">（自分）</span>}</span>
                    {isMe && <button onClick={() => { if (checkDemo()) return; setNameDraft(m.name); setIsEditingName(true); }} className={buttonClass.icon} aria-label="表示名を変更"><Pencil size={15} /></button>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {canInvite && (
        <Card className="p-5 mb-6">
          <SectionTitle>パートナーを招待</SectionTitle>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">招待リンクを送ると、相手が Google でログインして、この家計に参加できます。リンクは24時間有効で、1回だけ使えます。</p>
          {invite ? (
            <>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-center mb-3">
                <p className="text-[10px] font-bold text-slate-400 mb-1">招待コード</p>
                <p className="text-2xl font-black text-slate-800 tracking-[0.2em] tabular">{invite.code}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleShare} className={`${buttonClass.primary} py-3 text-sm`}><Share2 size={16} /> 送る</button>
                <button onClick={handleCopy} className={`${buttonClass.secondary} py-3 text-sm`}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'コピーしました' : 'リンクをコピー'}</button>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-3">相手が参加すると、この画面を開き直したときにメンバーに表示されます</p>
            </>
          ) : (
            <button onClick={handleCreateInvite} disabled={isCreatingInvite} className={`${buttonClass.primary} w-full py-3.5 text-sm`}>
              {isCreatingInvite ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} 招待リンクを作る
            </button>
          )}
          {inviteError && <p className="text-xs text-rose-500 font-bold text-center mt-3">{inviteError}</p>}
        </Card>
      )}

      <button onClick={() => setIsLogoutOpen(true)} className={`${buttonClass.secondary} w-full py-3 text-sm hover:!text-rose-500`}>
        <LogOut size={16} /> {isDemoMode ? 'デモを終わる' : 'ログアウト'}
      </button>
    </PageShell>
  );
}
