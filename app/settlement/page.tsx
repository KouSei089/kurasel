'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Modal from '../components/Modal';
import EditModal from '../components/EditModal';
import CategoryChart from '../components/CategoryChart';
import AnalysisModal from '../components/AnalysisModal';
import { Smile, MessageCircle, Send, Pencil, Trash2, X, Check, Paperclip, Sparkles, ChevronDown, ChevronUp, HelpCircle, ArrowLeft, CheckCircle2, Clock, Lock, ShieldCheck } from 'lucide-react';
import { DEMO_EXPENSES, DEMO_STATUS } from '../lib/demoData';

// ... (型定義や定数はそのまま) ...
type Comment = { id: string; user: string; text: string; timestamp: string; };
type Expense = { id: number; store_name: string; amount: number; purchase_date: string; created_at: string; paid_by: string; category: string | null; reactions: { [key: string]: string } | null; comments: Comment[] | null; receipt_url: string | null; };
type MonthlyStatus = { is_paid: boolean; is_received: boolean; };
const REACTION_TYPES = [
  { id: 'heart', src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Red%20Heart.png', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600' },
  { id: 'good', src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Thumbs%20Up.png', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
  { id: 'party', src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600' },
  { id: 'please', src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Folded%20Hands.png', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600' },
];
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
const formatDateTime = (isoString: string) => { if (!isoString) return ''; const d = new Date(isoString); return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`; };

export default function SettlementPage() {
  const router = useRouter();
  // ▼変更: 初期値はfalseにし、useEffectでlocalStorageから判定
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [myUserName, setMyUserName] = useState<string>('');
  const [monthlyStatus, setMonthlyStatus] = useState<MonthlyStatus>({ is_paid: false, is_received: false });
  const [useSmartSplit, setUseSmartSplit] = useState(false);
  const SCAN_BONUS_PER_ITEM = 50; 
  const [activePickerId, setActivePickerId] = useState<number | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'confirm' as 'alert' | 'confirm', title: '', message: '', confirmText: 'OK', onConfirm: () => {}, });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [showDetails, setShowDetails] = useState(false);

  // ▼変更: 起動時にモードとユーザーを判定
  useEffect(() => {
    const mode = localStorage.getItem('kurasel_mode');
    const storedName = localStorage.getItem('scan_io_user_name');

    if (mode === 'demo') {
      setIsDemoMode(true);
      setMyUserName('あなた'); // デモの場合は強制的に「あなた」
    } else {
      setIsDemoMode(false);
      if (!storedName) {
        router.push('/login');
      } else {
        setMyUserName(storedName);
      }
    }
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
      case 'food': return '🥦'; case 'daily': return '🧻'; case 'eatout': return '🍻'; case 'transport': return '🚃'; case 'other': return '📦'; default: return '📄';
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);

    if (isDemoMode) {
      setTimeout(() => {
        setExpenses(DEMO_EXPENSES as any);
        setMonthlyStatus(DEMO_STATUS);
        setLoading(false);
      }, 500);
      return;
    }

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const firstDayStr = toYMD(new Date(year, month, 1));
    const lastDayStr = toYMD(new Date(year, month + 1, 0));
    
    const { data: expensesData, error: expensesError } = await supabase.from('expenses').select('*').gte('purchase_date', firstDayStr).lte('purchase_date', lastDayStr).order('created_at', { ascending: false });
    if (expensesError) console.error(expensesError); else setExpenses(expensesData || []);

    const { data: statusData } = await supabase.from('monthly_settlements').select('*').eq('month', monthKey).single();
    if (statusData) { setMonthlyStatus({ is_paid: statusData.is_paid, is_received: statusData.is_received }); } else { setMonthlyStatus({ is_paid: false, is_received: false }); }
    setLoading(false);
  };

  useEffect(() => { 
    // isDemoModeの判定が終わってからfetchするように制御（初期ロード時のちらつき防止）
    if (myUserName) fetchExpenses(); 
  }, [currentMonth, isDemoMode, myUserName]);

  const checkDemo = () => { if (isDemoMode) { alert('⚠️ DEMOモード中はこの操作はできません'); return true; } return false; };

  const handleStatusClick = (type: 'paid' | 'received') => {
    if (checkDemo()) return;
    const isPaidAction = type === 'paid';
    const willBeActive = isPaidAction ? !monthlyStatus.is_paid : !monthlyStatus.is_received;
    let title = '', message = '', confirmText = '';
    if (isPaidAction) {
      if (willBeActive) { title = '支払い完了の確認'; message = '相手への支払いは完了しましたか？\nステータスを「支払い済み」に変更します。'; confirmText = '完了とする'; } else { title = '支払いの取り消し'; message = '「支払い済み」ステータスを取り消して元に戻しますか？'; confirmText = '取り消す'; }
    } else {
      if (willBeActive) { title = '精算完了の確認'; message = '相手からの受け取りを確認しましたか？\nこれを押すと今月の精算は完了となります。'; confirmText = '精算完了'; } else { title = '受け取りの取り消し'; message = '「精算完了」ステータスを取り消して元に戻しますか？'; confirmText = '取り消す'; }
    }
    setModalConfig({ isOpen: true, type: 'confirm', title, message, confirmText, onConfirm: () => executeToggleStatus(type), });
  };

  const executeToggleStatus = async (type: 'paid' | 'received') => {
    closeModal();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const newStatus = { ...monthlyStatus };
    if (type === 'paid') newStatus.is_paid = !newStatus.is_paid;
    if (type === 'received') newStatus.is_received = !newStatus.is_received;
    setMonthlyStatus(newStatus);
    const { error } = await supabase.from('monthly_settlements').upsert({ month: monthKey, is_paid: newStatus.is_paid, is_received: newStatus.is_received, updated_at: new Date().toISOString() });
    if (error) { console.error(error); setMonthlyStatus(monthlyStatus); alert('更新失敗'); }
  };

  const changeMonth = (amount: number) => { const newDate = new Date(currentMonth); newDate.setMonth(newDate.getMonth() + amount); setCurrentMonth(newDate); setVisibleCount(10); };
  const handleDeleteClick = (id: number) => { if (checkDemo()) return; setModalConfig({ isOpen: true, type: 'confirm', title: '記録の削除', message: 'この記録を削除してもよろしいですか？', confirmText: '削除する', onConfirm: () => handleDelete(id), }); };
  const handleDelete = async (id: number) => { closeModal(); try { const { data: targetItem, error: fetchError } = await supabase.from('expenses').select('receipt_url').eq('id', id).single(); if (fetchError) throw fetchError; if (targetItem?.receipt_url) { const fileName = targetItem.receipt_url.split('/').pop(); if (fileName) await supabase.storage.from('receipts').remove([fileName]); } const { error: deleteError } = await supabase.from('expenses').delete().eq('id', id); if (deleteError) throw deleteError; setExpenses(expenses.filter(e => e.id !== id)); } catch (error) { console.error('削除処理エラー:', error); alert('削除に失敗しました'); } };
  const handleEditClick = (item: Expense) => { if (checkDemo()) return; setEditingItem(item); setIsEditOpen(true); };
  const handleUpdateComplete = () => { fetchExpenses(); };
  const handleAnalyze = () => { setIsAnalyzing(true); setTimeout(() => { const msg = isDemoMode ? `## 🤖 DEMO分析\n\nこれはデモデータに基づいた分析です。\n今月の支出バランスは非常に良好です！` : `## 🚧 準備中 (Coming Soon)\n\nAI家計診断機能は、次回のアップデートで公開予定です！\n\n実装をお楽しみに！`; setAnalysisResult(msg); setIsAnalysisOpen(true); setIsAnalyzing(false); }, 500); };
  const handleReaction = async (item: Expense, reactionId: string) => { if (checkDemo()) return; const currentReactions = item.reactions || {}; const myCurrentReactionId = currentReactions[myUserName]; let newReactions = { ...currentReactions }; if (myCurrentReactionId === reactionId) delete newReactions[myUserName]; else newReactions[myUserName] = reactionId; setActivePickerId(null); const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, reactions: newReactions } : e); setExpenses(updatedExpenses); await supabase.from('expenses').update({ reactions: newReactions }).eq('id', item.id); };
  const handleCommentSubmit = async (item: Expense) => { if (checkDemo()) return; if (!commentText.trim()) return; const newComment: Comment = { id: generateId(), user: myUserName, text: commentText.trim(), timestamp: new Date().toISOString(), }; const currentComments = item.comments || []; const newComments = [...currentComments, newComment]; const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, comments: newComments } : e); setExpenses(updatedExpenses); setCommentText(''); await supabase.from('expenses').update({ comments: newComments }).eq('id', item.id); };
  const handleDeleteCommentClick = (item: Expense, commentId: string) => { if (checkDemo()) return; setModalConfig({ isOpen: true, type: 'confirm', title: 'コメントの削除', message: '本当にこのコメントを削除しますか？', confirmText: '削除する', onConfirm: () => executeDeleteComment(item, commentId), }); };
  const executeDeleteComment = async (item: Expense, commentId: string) => { closeModal(); const currentComments = item.comments || []; const newComments = currentComments.filter(c => c.id !== commentId); const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, comments: newComments } : e); setExpenses(updatedExpenses); await supabase.from('expenses').update({ comments: newComments }).eq('id', item.id); };
  const handleStartEditComment = (comment: Comment) => { setEditingCommentId(comment.id); setEditingText(comment.text); };
  const handleSaveEditComment = async (item: Expense) => { if (checkDemo()) return; if (!editingText.trim() || !editingCommentId) return; const currentComments = item.comments || []; const newComments = currentComments.map(c => c.id === editingCommentId ? { ...c, text: editingText.trim() } : c); const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, comments: newComments } : e); setExpenses(updatedExpenses); setEditingCommentId(null); setEditingText(''); await supabase.from('expenses').update({ comments: newComments }).eq('id', item.id); };
  const formatDate = (dateString: string) => { const d = new Date(dateString); return `${d.getMonth() + 1}/${d.getDate()}`; };

  const totalMe = expenses.filter(e => e.paid_by === myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalPartner = expenses.filter(e => e.paid_by !== myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = totalMe + totalPartner;
  const splitAmount = Math.round(totalAmount / 2); 
  const basicBalance = totalMe - splitAmount; 
  const myScanCount = expenses.filter(e => e.paid_by === myUserName).length;
  const partnerScanCount = expenses.filter(e => e.paid_by !== myUserName).length;
  const scanDiff = myScanCount - partnerScanCount; 
  const scanBonus = scanDiff * SCAN_BONUS_PER_ITEM; 
  const smartBalanceRaw = basicBalance + scanBonus;
  const roundTo100 = (num: number) => { const abs = Math.abs(num); const rounded = Math.floor(abs / 100) * 100; return num >= 0 ? rounded : -rounded; };
  const finalBalance = useSmartSplit ? roundTo100(smartBalanceRaw) : Math.round(basicBalance);
  const monthLabel = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;
  const isPayer = finalBalance < 0;
  const isReceiver = finalBalance > 0;
  const isSettled = monthlyStatus.is_received;

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100"></div>;

  return (
    <div className={`px-4 py-8 sm:p-8 max-w-md mx-auto min-h-screen text-gray-700 relative pb-32 font-medium transition-colors duration-500 ${isDemoMode ? 'bg-orange-50/50' : 'bg-gradient-to-br from-slate-50 to-gray-100'}`}>
      
      {isDemoMode && (
        <div className="fixed top-0 left-0 w-full bg-orange-400 text-white text-xs font-bold text-center py-1 z-50 shadow-md">
          🚧 DEMO MODE - データは保存されません
        </div>
      )}

      <Modal isOpen={modalConfig.isOpen} onClose={closeModal} type={modalConfig.type} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} confirmText={modalConfig.confirmText} />
      <EditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} expense={editingItem} onUpdate={handleUpdateComplete} />
      <AnalysisModal isOpen={isAnalysisOpen} onClose={() => setIsAnalysisOpen(false)} analysis={analysisResult} loading={isAnalyzing} />

      <div className="flex justify-between items-center mb-6 sm:mb-8 mt-4">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-700 drop-shadow-sm flex items-center gap-2">
          精算 
          {isDemoMode && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full border border-orange-200">DEMO</span>}
        </h1>
        
        <div className="flex gap-2">
          {/* ▼スイッチボタンは削除しました */}

          <button onClick={() => window.location.href = '/'} className="text-xs sm:text-sm font-bold text-slate-600 bg-white/80 backdrop-blur-md border border-white/40 px-3 py-2 sm:px-4 sm:py-2 rounded-full hover:bg-white hover:-translate-y-0.5 transition-all shadow-sm flex items-center gap-1">
            <ArrowLeft size={14} /> 入力へ
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white/70 backdrop-blur-xl p-3 sm:p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-6 sm:mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/50 to-transparent pointer-events-none"></div>
        <button onClick={() => changeMonth(-1)} className="p-3 sm:p-4 hover:bg-white/50 rounded-full transition text-gray-500 relative z-10 text-xs sm:text-sm">◀︎ 先月</button>
        <span className="font-black text-lg sm:text-2xl text-gray-700 relative z-10">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} className="p-3 sm:p-4 hover:bg-white/50 rounded-full transition text-gray-500 relative z-10 text-xs sm:text-sm">次月 ▶︎</button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-600 font-bold animate-pulse">読み込み中...</div>
      ) : (
        <>
          <CategoryChart expenses={expenses} />

          <button onClick={handleAnalyze} className="w-full mb-6 sm:mb-8 py-3 sm:py-4 bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl shadow-sm text-slate-600 font-bold hover:bg-white hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group text-sm sm:text-base">
            <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">🤖</span>
            <span>AI家計診断を受ける</span>
          </button>

          {/* スマート精算切り替え */}
          <div className="mb-6 bg-white/60 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-white/40 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${useSmartSplit ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Sparkles size={18} className={useSmartSplit ? 'fill-amber-400' : ''} />
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

          <div className={`p-6 sm:p-8 rounded-3xl text-white shadow-[0_10px_40px_rgb(0,0,0,0.15)] border border-white/20 mb-6 transition-all relative overflow-hidden ${isSettled ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : finalBalance === 0 ? 'bg-gradient-to-br from-gray-500 to-gray-600' : finalBalance > 0 ? 'bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/20' : 'bg-gradient-to-br from-rose-400 to-rose-500 shadow-rose-500/20'}`}>
            <div className="absolute inset-0 bg-white/10 mix-blend-overlay pointer-events-none"></div>
            
            {/* 精算ステータス表示エリア */}
            <div className="relative z-10 mb-4 flex flex-col items-center">
              {isSettled ? (
                 <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-md mb-2">
                   <CheckCircle2 size={20} className="text-white" />
                   <span className="font-bold">精算完了</span>
                   {/* 受け取る側のみ、完了を取り消せるボタンを表示 */}
                   {isReceiver && (
                     <button onClick={() => handleStatusClick('received')} className="ml-2 bg-white/20 p-1 rounded-full hover:bg-white/40">
                        {/* デモモードの時はアイコンをLockに変更 */}
                        {isDemoMode ? <Lock size={14} /> : <X size={14} />}
                     </button>
                   )}
                 </div>
              ) : (
                <>
                  {/* 支払う側の表示 */}
                  {isPayer && (
                    <button 
                      onClick={() => handleStatusClick('paid')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md mb-2 font-bold transition-all ${monthlyStatus.is_paid ? 'bg-white/30 text-white' : 'bg-white text-rose-500 shadow-lg'} ${isDemoMode ? 'opacity-80 cursor-not-allowed' : ''}`}
                    >
                      {monthlyStatus.is_paid ? (
                        <> <Clock size={18} /> 支払い報告済み (相手の確認待ち) </>
                      ) : (
                        <> <Send size={18} /> 支払いを完了する </>
                      )}
                    </button>
                  )}

                  {/* 受け取る側の表示 */}
                  {isReceiver && (
                    <div className="flex flex-col items-center gap-2">
                      {monthlyStatus.is_paid && (
                        <span className="text-xs bg-white/20 px-3 py-1 rounded-full animate-pulse">相手が「支払い済み」にしました</span>
                      )}
                      <button 
                        onClick={() => handleStatusClick('received')}
                        className={`flex items-center gap-2 bg-white text-slate-600 px-6 py-3 rounded-full shadow-lg font-bold hover:bg-slate-50 transition-all active:scale-95 ${isDemoMode ? 'opacity-80 cursor-not-allowed' : ''}`}
                      >
                         <CheckCircle2 size={20} className="text-emerald-500" /> 受け取り完了 (精算済みにする)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="text-xs sm:text-sm font-bold opacity-90 mb-2 relative z-10 text-center">{monthLabel}の精算{useSmartSplit && ' (調整済)'}</p>
            <h2 className="text-2xl sm:text-4xl font-black mb-4 relative z-10 drop-shadow-sm leading-tight text-center">
              {finalBalance === 0 ? '精算なし' : (
                <>相手{finalBalance > 0 ? 'から' : 'へ'}<br className="sm:hidden" /><span className="mx-1 sm:mx-3 underline underline-offset-8 decoration-white/50">{Math.abs(finalBalance).toLocaleString()}</span>円{finalBalance > 0 ? 'もらう' : '払う'}</>
              )}
            </h2>

            <div className="mt-4 bg-black/20 rounded-xl overflow-hidden relative z-10">
              <button 
                onClick={() => setShowDetails(!showDetails)}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2"><HelpCircle size={14} /> 計算の内訳を見る</span>
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {showDetails && (
                <div className="px-4 pb-4 pt-1 text-xs space-y-2 opacity-90 border-t border-white/10">
                  <div className="flex justify-between border-b border-white/10 py-1"><span>全体の支出</span><span className="font-mono">{totalAmount.toLocaleString()} 円</span></div>
                  <div className="flex justify-between border-b border-white/10 py-1"><span>1人あたり (÷2)</span><span className="font-mono">{splitAmount.toLocaleString()} 円</span></div>
                  <div className="flex justify-between border-b border-white/10 py-1"><span>あなたの立替済</span><span className="font-mono">{totalMe.toLocaleString()} 円</span></div>
                  <div className="flex justify-between border-b border-white/10 py-1 text-emerald-200"><span>基本の差額</span><span className="font-mono">{basicBalance > 0 ? '+' : ''}{basicBalance.toLocaleString()} 円</span></div>
                  {useSmartSplit && (
                    <>
                      <div className="flex justify-between border-b border-white/10 py-1 text-amber-200"><span>スキャン手当 ({scanDiff > 0 ? '+' : ''}{scanDiff}回)</span><span className="font-mono">{scanBonus > 0 ? '+' : ''}{scanBonus.toLocaleString()} 円</span></div>
                      <div className="pt-2 text-[10px] text-center opacity-70">※ 100円未満を端数調整しています</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-10 relative overflow-hidden">
            <h3 className="font-bold mb-4 sm:mb-6 pb-3 text-gray-700 border-b border-gray-200/50 relative z-10 text-sm sm:text-base">支出の内訳</h3>
            <div className="flex justify-between mb-4 relative z-10">
              <span className="flex items-center text-gray-700 font-bold text-xs sm:text-sm"><span className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full mr-2 sm:mr-4 shadow-sm"></span>あなた</span>
              <div className="text-right">
                  <span className="font-black text-lg sm:text-xl block">{totalMe.toLocaleString()}円</span>
                  <span className="text-[10px] sm:text-xs text-gray-400 font-bold">スキャン: {myScanCount}回</span>
              </div>
            </div>
            <div className="flex justify-between pt-2 sm:pt-4 relative z-10">
              <span className="flex items-center text-gray-700 font-bold text-xs sm:text-sm"><span className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full mr-2 sm:mr-4 shadow-sm"></span>相手</span>
              <div className="text-right">
                <span className="font-black text-lg sm:text-xl text-rose-600 block">{totalPartner.toLocaleString()}円</span>
                <span className="text-[10px] sm:text-xs text-rose-300 font-bold">スキャン: {partnerScanCount}回</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-4 sm:mb-6 text-gray-700 ml-2 text-sm sm:text-base">{monthLabel}の履歴 ({expenses.length}件)</h3>
            {expenses.length === 0 ? (
              <p className="text-center text-gray-500 font-bold text-sm py-12 bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40">データがありません</p>
            ) : (
              <>
                <ul className="space-y-3 sm:space-y-4">
                  {expenses.slice(0, visibleCount).map((item) => {
                    const isMe = item.paid_by === myUserName;
                    const reactions = item.reactions || {};
                    const reactionEntries = Object.entries(reactions);
                    const comments = item.comments || [];
                    const isCommentOpen = activeCommentId === item.id;

                    return (
                      <li key={item.id} className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl shadow-sm border border-white/60 hover:bg-white transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <span className="text-2xl sm:text-3xl bg-gray-100/80 p-2 sm:p-3 rounded-2xl shadow-inner">{getCategoryIcon(item.category)}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                  <p className="font-black text-gray-800 text-base sm:text-lg mb-0.5 line-clamp-1">{item.store_name || '店名なし'}</p>
                                  {item.receipt_url && (
                                      <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 rounded-full transition-colors" onClick={(e) => e.stopPropagation()}>
                                          <Paperclip size={14} />
                                      </a>
                                  )}
                              </div>
                              <div className="flex items-center gap-2">
                                {item.created_at && (
                                  <p className="text-gray-400 text-[10px] font-mono font-bold">
                                    {formatDateTime(item.created_at)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-lg sm:text-xl mb-1 text-slate-700">¥{item.amount.toLocaleString()}</p>
                            <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full font-bold shadow-sm ${isMe ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600'}`}>{item.paid_by}</span>
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
                                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-sm leading-none shadow-sm transition-all border group relative overflow-hidden ${isMyReaction ? `${reactionType.bg} ${reactionType.border} ${reactionType.text} ring-1 ring-white` : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 grayscale hover:grayscale-0'}`}
                              >
                                <img src={reactionType.src} alt="reaction" className="w-4 h-4 sm:w-5 sm:h-5 object-contain block drop-shadow-sm" />
                                <span className="text-[10px] font-bold">{user}</span>
                              </button>
                            );
                          })}

                          <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setActivePickerId(activePickerId === item.id ? null : item.id); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors leading-none"><Smile size={18} strokeWidth={2.5} /></button>
                            {activePickerId === item.id && (
                              <div className="absolute left-0 bottom-full mb-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-2 flex gap-2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                                {REACTION_TYPES.map((type) => (
                                  <button key={type.id} onClick={(e) => { e.stopPropagation(); handleReaction(item, type.id); }} className="w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:scale-125 active:scale-95 hover:bg-slate-50">
                                    <img src={type.src} alt={type.id} className="w-8 h-8 object-contain drop-shadow-sm" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button onClick={() => setActiveCommentId(isCommentOpen ? null : item.id)} className={`w-8 h-8 flex items-center justify-center rounded-full border transition-colors leading-none ${comments.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-500' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>
                            <MessageCircle size={18} strokeWidth={2.5} className={comments.length > 0 ? 'fill-blue-100' : ''} />
                          </button>

                          {isMe && (
                            <div className="ml-auto flex gap-3">
                              <button onClick={() => handleEditClick(item)} className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors">編集</button>
                              <button onClick={() => handleDeleteClick(item.id)} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">削除</button>
                            </div>
                          )}
                        </div>

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
                                          <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="flex-1 bg-white border border-blue-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none h-20" />
                                          <div className="flex flex-col gap-2"><button onClick={() => handleSaveEditComment(item)} className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"><Check size={14} /></button><button onClick={() => setEditingCommentId(null)} className="p-2 bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300"><X size={14} /></button></div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-sm relative group ${isMyComment ? 'bg-blue-500 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                                            {comment.text}
                                            {isMyComment && (<div className="absolute -left-16 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleDeleteCommentClick(item, comment.id)} className="p-1.5 bg-rose-100 text-rose-500 rounded-full hover:bg-rose-200"><Trash2 size={12} /></button><button onClick={() => handleStartEditComment(comment)} className="p-1.5 bg-blue-100 text-blue-500 rounded-full hover:bg-blue-200"><Pencil size={12} /></button></div>)}
                                          </div>
                                          <div className="flex gap-2 mt-1 px-1"><span className="text-[10px] font-bold text-slate-400">{comment.user}</span><span className="text-[10px] text-slate-300">{formatDate(comment.timestamp)}</span></div>
                                        </>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (<p className="text-xs text-slate-400 text-center mb-4">まだコメントはありません。会話を始めましょう！</p>)}
                            <div className="flex gap-2 items-end">
                              <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleCommentSubmit(item); }} placeholder="コメントを入力..." className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all resize-none h-12 min-h-[48px] max-h-32" />
                              <button onClick={() => handleCommentSubmit(item)} disabled={!commentText.trim()} className="w-10 h-10 mb-1 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all active:scale-95"><Send size={18} strokeWidth={2.5} className="ml-0.5" /></button>
                            </div>
                            <p className="text-[10px] text-slate-300 text-center mt-2">Ctrl + Enter で送信</p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {expenses.length > visibleCount && (
                  <button onClick={() => setVisibleCount(prev => prev + 10)} className="w-full py-3 mt-4 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1">もっと見る <ChevronDown size={14} /></button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}