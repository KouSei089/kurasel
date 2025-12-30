'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Modal from '../components/Modal';
import EditModal from '../components/EditModal';
import CategoryChart from '../components/CategoryChart';
import AnalysisModal from '../components/AnalysisModal';
// ★追加: Paperclip (画像用), Sparkles (スマート精算用)
import { Smile, MessageCircle, Send, Pencil, Trash2, X, Check, Paperclip, Sparkles } from 'lucide-react';

type Comment = {
  id: string;
  user: string;
  text: string;
  timestamp: string;
};

type Expense = {
  id: number;
  store_name: string;
  amount: number;
  purchase_date: string;
  created_at: string;
  paid_by: string;
  category: string | null;
  reactions: { [key: string]: string } | null;
  comments: Comment[] | null;
  // ★追加: 画像URL
  receipt_url: string | null;
};

const REACTION_TYPES = [
  { 
    id: 'heart', 
    src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Red%20Heart.png',
    bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600'
  },
  { 
    id: 'good', 
    src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Thumbs%20Up.png',
    bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600'
  },
  { 
    id: 'party', 
    src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png',
    bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600'
  },
  { 
    id: 'please', 
    src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Folded%20Hands.png',
    bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600'
  },
];

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export default function SettlementPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [myUserName, setMyUserName] = useState<string>('');
  
  // ★追加: スマート精算モードのON/OFF管理
  const [useSmartSplit, setUseSmartSplit] = useState(false);
  const SCAN_BONUS_PER_ITEM = 50; // 1回のスキャンにつき50円の手当

  const [activePickerId, setActivePickerId] = useState<number | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const [modalConfig, setModalConfig] = useState({
    isOpen: false, type: 'confirm' as 'alert' | 'confirm', title: '', message: '', onConfirm: () => {},
  });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem('scan_io_user_name');
    if (!storedName) router.push('/login');
    else setMyUserName(storedName);
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if ((e.target as Element).closest('.comment-area')) return;
      setActivePickerId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const getCategoryIcon = (cat: string | null) => {
    switch(cat) {
      case 'food': return '🥦';
      case 'daily': return '🧻';
      case 'eatout': return '🍻';
      case 'transport': return '🚃';
      case 'other': return '📦';
      default: return '📄';
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const firstDayStr = toYMD(new Date(year, month, 1));
    const lastDayStr = toYMD(new Date(year, month + 1, 0));
    
    const { data, error } = await supabase.from('expenses').select('*').gte('purchase_date', firstDayStr).lte('purchase_date', lastDayStr).order('purchase_date', { ascending: false });
    if (error) console.error(error); else setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [currentMonth]);

  const changeMonth = (amount: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + amount);
    setCurrentMonth(newDate);
  };

  const handleDeleteClick = (id: number) => {
    setModalConfig({ isOpen: true, type: 'confirm', title: '記録の削除', message: 'この記録を削除してもよろしいですか？', onConfirm: () => handleDelete(id), });
  };

  const handleDelete = async (id: number) => {
    closeModal();
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) setExpenses(expenses.filter(e => e.id !== id));
    else alert('削除に失敗しました');
  };

  const handleEditClick = (item: Expense) => { setEditingItem(item); setIsEditOpen(true); };
  const handleUpdateComplete = () => { fetchExpenses(); };

  // ★維持: AI家計診断機能
  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setAnalysisResult(`## 🚧 準備中 (Coming Soon)\n\nAI家計診断機能は、次回のアップデートで公開予定です！\n\n実装をお楽しみに！`);
      setIsAnalysisOpen(true); setIsAnalyzing(false);
    }, 500);
  };

  const handleReaction = async (item: Expense, reactionId: string) => {
    const currentReactions = item.reactions || {};
    const myCurrentReactionId = currentReactions[myUserName];
    let newReactions = { ...currentReactions };

    if (myCurrentReactionId === reactionId) {
      delete newReactions[myUserName];
    } else {
      newReactions[myUserName] = reactionId;
    }

    setActivePickerId(null);
    const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, reactions: newReactions } : e);
    setExpenses(updatedExpenses);
    await supabase.from('expenses').update({ reactions: newReactions }).eq('id', item.id);
  };

  const handleCommentSubmit = async (item: Expense) => {
    if (!commentText.trim()) return;

    const newComment: Comment = {
      id: generateId(),
      user: myUserName,
      text: commentText.trim(),
      timestamp: new Date().toISOString(),
    };

    const currentComments = item.comments || [];
    const newComments = [...currentComments, newComment];

    const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, comments: newComments } : e);
    setExpenses(updatedExpenses);
    setCommentText('');

    await supabase.from('expenses').update({ comments: newComments }).eq('id', item.id);
  };

  const handleDeleteCommentClick = (item: Expense, commentId: string) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'コメントの削除',
      message: '本当にこのコメントを削除しますか？',
      onConfirm: () => executeDeleteComment(item, commentId),
    });
  };

  const executeDeleteComment = async (item: Expense, commentId: string) => {
    closeModal();
    const currentComments = item.comments || [];
    const newComments = currentComments.filter(c => c.id !== commentId);

    const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, comments: newComments } : e);
    setExpenses(updatedExpenses);

    await supabase.from('expenses').update({ comments: newComments }).eq('id', item.id);
  };

  const handleStartEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  const handleSaveEditComment = async (item: Expense) => {
    if (!editingText.trim() || !editingCommentId) return;

    const currentComments = item.comments || [];
    const newComments = currentComments.map(c => 
      c.id === editingCommentId ? { ...c, text: editingText.trim() } : c
    );

    const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, comments: newComments } : e);
    setExpenses(updatedExpenses);
    setEditingCommentId(null);
    setEditingText('');

    await supabase.from('expenses').update({ comments: newComments }).eq('id', item.id);
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // ★追加: スマート精算ロジック
  const totalMe = expenses.filter(e => e.paid_by === myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalPartner = expenses.filter(e => e.paid_by !== myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = totalMe + totalPartner;
  const splitAmount = Math.round(totalAmount / 2); // 単純折半額（参考用）
  
  // 通常の精算額（端数そのまま）
  const basicBalance = totalMe - (totalAmount / 2); // プラスなら受け取る側

  // スキャン回数の集計
  const myScanCount = expenses.filter(e => e.paid_by === myUserName).length;
  const partnerScanCount = expenses.filter(e => e.paid_by !== myUserName).length;
  const scanDiff = myScanCount - partnerScanCount; // プラスなら自分が多くスキャンした
  const scanBonus = scanDiff * SCAN_BONUS_PER_ITEM; // 受け取るべき手当（マイナスなら払う）

  // スマート精算額の計算（手当加算 ＆ 100円単位丸め）
  const smartBalanceRaw = basicBalance + scanBonus;

  // 100円単位への丸め関数 (正負を考慮)
  const roundTo100 = (num: number) => {
      const abs = Math.abs(num);
      const rounded = Math.floor(abs / 100) * 100;
      return num >= 0 ? rounded : -rounded;
  };

  // 最終的な精算額（モードによって切り替え）
  const finalBalance = useSmartSplit ? roundTo100(smartBalanceRaw) : Math.round(basicBalance);

  const monthLabel = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  if (!myUserName) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100"></div>;

  return (
    <div className="p-8 max-w-md mx-auto min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 text-gray-700 relative pb-32 font-medium">
      <Modal isOpen={modalConfig.isOpen} onClose={closeModal} type={modalConfig.type} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} confirmText="削除する" />
      <EditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} expense={editingItem} onUpdate={handleUpdateComplete} />
      <AnalysisModal isOpen={isAnalysisOpen} onClose={() => setIsAnalysisOpen(false)} analysis={analysisResult} loading={isAnalyzing} />

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-700 drop-shadow-sm">精算</h1>
        <button onClick={() => window.location.href = '/'} className="text-sm font-bold text-slate-600 bg-white/80 backdrop-blur-md border border-white/40 px-4 py-2 rounded-full hover:bg-white hover:-translate-y-0.5 transition-all shadow-sm">← 入力に戻る</button>
      </div>

      <div className="flex items-center justify-between bg-white/70 backdrop-blur-xl p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/50 to-transparent pointer-events-none"></div>
        <button onClick={() => changeMonth(-1)} className="p-4 hover:bg-white/50 rounded-full transition text-gray-500 relative z-10">◀︎ 先月</button>
        <span className="font-black text-2xl text-gray-700 relative z-10">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} className="p-4 hover:bg-white/50 rounded-full transition text-gray-500 relative z-10">次月 ▶︎</button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-600 font-bold animate-pulse">読み込み中...</div>
      ) : (
        <>
          <CategoryChart expenses={expenses} />

          {/* ★維持: AI家計診断ボタン */}
          <button onClick={handleAnalyze} className="w-full mb-8 py-4 bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl shadow-sm text-slate-600 font-bold hover:bg-white hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group">
            <span className="text-2xl group-hover:scale-110 transition-transform">🤖</span>
            <span>AI家計診断を受ける</span>
          </button>

          {/* ★追加: スマート精算切り替えスイッチ */}
          <div className="mb-6 bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-white/40 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${useSmartSplit ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Sparkles size={20} className={useSmartSplit ? 'fill-amber-400' : ''} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">スマート精算</p>
                    <p className="text-[10px] text-slate-400">スキャン手当 ＆ 100円単位で調整</p>
                  </div>
              </div>
              <button 
                onClick={() => setUseSmartSplit(!useSmartSplit)}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ease-in-out ${useSmartSplit ? 'bg-slate-700' : 'bg-slate-300'}`}
              >
                  <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-200 ${useSmartSplit ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
          </div>

          <div className={`p-8 rounded-3xl text-white shadow-[0_10px_40px_rgb(0,0,0,0.15)] border border-white/20 mb-6 transition-all relative overflow-hidden ${finalBalance === 0 ? 'bg-gradient-to-br from-gray-500 to-gray-600' : finalBalance > 0 ? 'bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/20' : 'bg-gradient-to-br from-rose-400 to-rose-500 shadow-rose-500/20'}`}>
            <div className="absolute inset-0 bg-white/10 mix-blend-overlay pointer-events-none"></div>
            <p className="text-sm font-bold opacity-90 mb-2 relative z-10">{monthLabel}の精算{useSmartSplit && ' (調整済)'}</p>
            <h2 className="text-4xl font-black mb-4 relative z-10 drop-shadow-sm">
              {finalBalance === 0 ? '精算なし' : (
                <>相手{finalBalance > 0 ? 'から' : 'へ'}<span className="mx-3 underline underline-offset-8 decoration-white/50">{Math.abs(finalBalance).toLocaleString()}</span>円{finalBalance > 0 ? 'もらう' : '払う'}</>
              )}
            </h2>

            {/* ★追加: 手当の内訳表示 */}
            {useSmartSplit && scanDiff !== 0 && (
                <div className="text-xs font-bold bg-white/20 p-3 rounded-xl backdrop-blur-md mb-2 relative z-10">
                    <p className="mb-1">🎁 スキャン感謝手当: {scanBonus > 0 ? '+' : ''}{scanBonus.toLocaleString()}円</p>
                    <p className="opacity-80">
                        (あなた: {myScanCount}回 vs 相手: {partnerScanCount}回 = 差{scanDiff > 0 ? '+' : ''}{scanDiff}回 × {SCAN_BONUS_PER_ITEM}円)
                    </p>
                </div>
            )}
            
            <p className="text-sm font-bold opacity-80 text-right relative z-10">
                {useSmartSplit 
                    ? `(元々の差額: ${basicBalance > 0 ? '+' : ''}${Math.round(basicBalance).toLocaleString()}円)` 
                    : `(合計: ${totalAmount.toLocaleString()}円 / 2)`}
            </p>
          </div>

          <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-10 relative overflow-hidden">
            <h3 className="font-bold mb-6 pb-3 text-gray-700 border-b border-gray-200/50 relative z-10">内訳</h3>
            <div className="flex justify-between mb-4 relative z-10">
              <span className="flex items-center text-gray-700 font-bold"><span className="w-4 h-4 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full mr-4 shadow-sm"></span>あなた ({myUserName})</span>
              <div className="text-right">
                  <span className="font-black text-xl block">{totalMe.toLocaleString()}円</span>
                  {/* ★追加: スキャン回数表示 */}
                  <span className="text-xs text-gray-400 font-bold">スキャン: {myScanCount}回</span>
              </div>
            </div>
            <div className="flex justify-between pt-4 relative z-10">
              <span className="flex items-center text-gray-700 font-bold"><span className="w-4 h-4 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full mr-4 shadow-sm"></span>相手</span>
              <div className="text-right">
                <span className="font-black text-xl text-rose-600 block">{totalPartner.toLocaleString()}円</span>
                <span className="text-xs text-rose-300 font-bold">スキャン: {partnerScanCount}回</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-6 text-gray-700 ml-2">{monthLabel}の履歴 ({expenses.length}件)</h3>
            {expenses.length === 0 ? (
              <p className="text-center text-gray-500 font-bold text-sm py-12 bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40">データがありません</p>
            ) : (
              <ul className="space-y-4">
                {expenses.map((item) => {
                  const isMe = item.paid_by === myUserName;
                  const reactions = item.reactions || {};
                  const reactionEntries = Object.entries(reactions);
                  const comments = item.comments || [];
                  const isCommentOpen = activeCommentId === item.id;

                  return (
                    <li key={item.id} className="bg-white/80 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/60 hover:bg-white transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-4">
                          <span className="text-3xl bg-gray-100/80 p-3 rounded-2xl shadow-inner">{getCategoryIcon(item.category)}</span>
                          <div>
                            <div className="flex items-center gap-2">
                                <p className="font-black text-gray-800 text-lg mb-0.5">{item.store_name || '店名なし'}</p>
                                {/* ★追加: 画像URLがある場合、クリップアイコンを表示 */}
                                {item.receipt_url && (
                                    <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 rounded-full transition-colors" onClick={(e) => e.stopPropagation()}>
                                        <Paperclip size={14} />
                                    </a>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-gray-500 text-xs font-bold">{formatDate(item.purchase_date)}</p>
                              {item.created_at && <p className="text-gray-300 text-[10px]">(登録: {formatDate(item.created_at)})</p>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-xl mb-1 text-slate-700">¥{item.amount.toLocaleString()}</p>
                          <span className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${isMe ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600'}`}>{item.paid_by}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2 relative min-h-[32px] flex-wrap">
                        {reactionEntries.map(([user, reactionId]) => {
                          const isMyReaction = user === myUserName;
                          const reactionType = REACTION_TYPES.find(r => r.id === reactionId);
                          if (!reactionType) return null;
                          return (
                            <button
                              key={user}
                              onClick={(e) => { e.stopPropagation(); handleReaction(item, reactionId); }}
                              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm leading-none shadow-sm transition-all border group relative overflow-hidden ${
                                isMyReaction 
                                  ? `${reactionType.bg} ${reactionType.border} ${reactionType.text} ring-1 ring-white`
                                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 grayscale hover:grayscale-0'
                              }`}
                            >
                              <img src={reactionType.src} alt="reaction" className="w-5 h-5 object-contain block drop-shadow-sm transition-transform active:scale-90" />
                              <span className="text-[10px] font-bold">{user}</span>
                            </button>
                          );
                        })}

                        <div className="relative">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActivePickerId(activePickerId === item.id ? null : item.id); }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors leading-none"
                          >
                            <Smile size={18} strokeWidth={2.5} />
                          </button>
                          {activePickerId === item.id && (
                            <div className="absolute left-0 bottom-full mb-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-2 flex gap-2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                              {REACTION_TYPES.map((type) => (
                                <button
                                  key={type.id}
                                  onClick={(e) => { e.stopPropagation(); handleReaction(item, type.id); }}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:scale-125 active:scale-95 hover:bg-slate-50"
                                >
                                  <img src={type.src} alt={type.id} className="w-8 h-8 object-contain drop-shadow-sm" />
                                </button>
                              ))}
                              <div className="absolute left-3 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white"></div>
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={() => setActiveCommentId(isCommentOpen ? null : item.id)}
                          className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors leading-none ${
                            comments.length > 0 
                              ? 'bg-blue-50 border-blue-200 text-blue-500' 
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                          }`}
                        >
                          <MessageCircle size={18} strokeWidth={2.5} className={comments.length > 0 ? 'fill-blue-100' : ''} />
                          {comments.length > 0 && <span className="sr-only">{comments.length}</span>}
                        </button>

                        {isMe && (
                          <div className="ml-auto flex gap-3">
                            <button onClick={() => handleEditClick(item)} className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors">編集</button>
                            <button onClick={() => handleDeleteClick(item.id)} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">削除</button>
                          </div>
                        )}
                      </div>

                      {/* コメントエリア */}
                      {isCommentOpen && (
                        <div className="comment-area mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 fade-in duration-200">
                          {comments.length > 0 ? (
                            <ul className="space-y-4 mb-4">
                              {comments.map((comment, i) => {
                                const isMyComment = comment.user === myUserName;
                                const isEditing = editingCommentId === comment.id;

                                return (
                                  <li key={comment.id || i} className={`flex flex-col ${isMyComment ? 'items-end' : 'items-start'}`}>
                                    {isEditing ? (
                                      <div className="w-full max-w-[90%] flex gap-2 items-end">
                                        <textarea
                                          value={editingText}
                                          onChange={(e) => setEditingText(e.target.value)}
                                          className="flex-1 bg-white border border-blue-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none h-20"
                                        />
                                        <div className="flex flex-col gap-2">
                                          <button onClick={() => handleSaveEditComment(item)} className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"><Check size={14} /></button>
                                          <button onClick={() => setEditingCommentId(null)} className="p-2 bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300"><X size={14} /></button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-sm relative group ${
                                          isMyComment 
                                            ? 'bg-blue-500 text-white rounded-tr-none' 
                                            : 'bg-slate-100 text-slate-700 rounded-tl-none'
                                        }`}>
                                          {comment.text}
                                          {isMyComment && (
                                            <div className="absolute -left-16 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => handleDeleteCommentClick(item, comment.id)} className="p-1.5 bg-rose-100 text-rose-500 rounded-full hover:bg-rose-200"><Trash2 size={12} /></button>
                                              <button onClick={() => handleStartEditComment(comment)} className="p-1.5 bg-blue-100 text-blue-500 rounded-full hover:bg-blue-200"><Pencil size={12} /></button>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex gap-2 mt-1 px-1">
                                          <span className="text-[10px] font-bold text-slate-400">{comment.user}</span>
                                          <span className="text-[10px] text-slate-300">{formatDate(comment.timestamp)}</span>
                                        </div>
                                      </>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-400 text-center mb-4">まだコメントはありません。会話を始めましょう！</p>
                          )}

                          <div className="flex gap-2 items-end">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                  handleCommentSubmit(item);
                                }
                              }}
                              placeholder="コメントを入力..."
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all resize-none h-12 min-h-[48px] max-h-32"
                            />
                            <button 
                              onClick={() => handleCommentSubmit(item)}
                              disabled={!commentText.trim()}
                              className="w-10 h-10 mb-1 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all active:scale-95"
                            >
                              <Send size={18} strokeWidth={2.5} className="ml-0.5" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-300 text-center mt-2">Ctrl + Enter で送信</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}