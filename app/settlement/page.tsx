'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import EditModal from '../components/EditModal';
import { ExcludedChip } from '../components/ExcludedToggle';
import SettledChip from '../components/SettledChip';
import { PageShell, PageHeader, Card, MonthSwitcher, SettlementCard, CategoryBreakdown, Toggle, EmptyState, Loading, buttonClass } from '../components/ui';
import { Smile, MessageCircle, Send, Pencil, Trash2, X, Check, Paperclip, Sparkles, ChevronDown, CheckCheck } from 'lucide-react';
import { DEMO_EXPENSES, DEMO_STATUS } from '../lib/demoData';
import { findCategory, sumByCategory } from '../lib/categories';
import { useCurrentUser } from '../lib/useCurrentUser';
import { toLocalYMD } from '../lib/date';

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
  receipt_url: string | null;
  is_excluded: boolean; // おごり等で割り勘の対象外
  is_settled: boolean; // 途中精算で精算済みにした記録
};

type MonthlyStatus = {
  is_paid: boolean;
  is_received: boolean;
};

const REACTION_TYPES = [
  { id: 'heart', src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Red%20Heart.png', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600' },
  { id: 'good', src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Thumbs%20Up.png', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
  { id: 'party', src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600' },
  { id: 'please', src: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Folded%20Hands.png', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600' },
];

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// 履歴に出すのは「買った日」。created_atは入力した日時なので、
// まとめて入力すると全部同じ日付に見えてしまう。
// 月の絞り込みもpurchase_dateで行っているので基準を揃える。
const formatPurchaseDate = (ymd: string) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${y}/${m}/${d}`;
};

export default function SettlementPage() {
  const { isDemoMode, myUserName } = useCurrentUser();

  // 状態管理
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyStatus, setMonthlyStatus] = useState<MonthlyStatus>({ is_paid: false, is_received: false });
  const [useSmartSplit, setUseSmartSplit] = useState(false);
  const SCAN_BONUS_PER_ITEM = 50; 

  const [activePickerId, setActivePickerId] = useState<number | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'confirm' as 'alert' | 'confirm',
    title: '',
    message: '',
    confirmText: 'OK', 
    onConfirm: () => {},
  });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);

  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if ((e.target as Element).closest('.comment-area')) return;
      setActivePickerId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchExpenses = useCallback(async () => {
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

    const firstDayStr = toLocalYMD(new Date(year, month, 1));
    const lastDayStr = toLocalYMD(new Date(year, month + 1, 0));
    
    const { data: expensesData, error: expensesError } = await supabase.from('expenses')
      .select('*')
      .gte('purchase_date', firstDayStr)
      .lte('purchase_date', lastDayStr)
      .order('created_at', { ascending: false });
    
    if (expensesError) console.error(expensesError);
    else setExpenses(expensesData || []);

    const { data: statusData } = await supabase
      .from('monthly_settlements')
      .select('*')
      .eq('month', monthKey)
      .single();
    
    if (statusData) {
      setMonthlyStatus({ is_paid: statusData.is_paid, is_received: statusData.is_received });
    } else {
      setMonthlyStatus({ is_paid: false, is_received: false });
    }

    setLoading(false);
  }, [currentMonth, isDemoMode]);

  useEffect(() => {
    if (myUserName) fetchExpenses();
  }, [myUserName, fetchExpenses]);

  // デモモード操作ガード
  const checkDemo = () => {
    if (isDemoMode) {
      alert('⚠️ DEMOモード中はこの操作はできません');
      return true;
    }
    return false;
  };

  // AI分析実行
  const handleStatusClick = (type: 'paid' | 'received') => {
    if (checkDemo()) return;
    const isPaidAction = type === 'paid';
    const willBeActive = isPaidAction ? !monthlyStatus.is_paid : !monthlyStatus.is_received;
    let title = '', message = '', confirmText = '';

    if (isPaidAction) {
      if (willBeActive) {
        title = '支払い完了の確認'; message = '相手への支払いは完了しましたか？\nステータスを「支払い済み」に変更します。'; confirmText = '完了とする';
      } else {
        title = '支払いの取り消し'; message = '「支払い済み」ステータスを取り消して元に戻しますか？'; confirmText = '取り消す';
      }
    } else {
      if (willBeActive) {
        title = '精算完了の確認'; message = '相手からの受け取りを確認しましたか？\nこれを押すと今月の精算は完了となります。'; confirmText = '精算完了';
      } else {
        title = '受け取りの取り消し'; message = '「精算完了」ステータスを取り消して元に戻しますか？'; confirmText = '取り消す';
      }
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

  const handleDeleteClick = (id: number) => {
    if (checkDemo()) return;
    setModalConfig({ 
      isOpen: true, 
      type: 'confirm', 
      title: '記録の削除', 
      message: 'この記録を削除してもよろしいですか？', 
      confirmText: '削除する', 
      onConfirm: () => handleDelete(id), 
    });
  };

  const handleDelete = async (id: number) => {
    closeModal();
    try {
      const { data: targetItem, error: fetchError } = await supabase.from('expenses').select('receipt_url').eq('id', id).single();
      if (fetchError) throw fetchError;
      if (targetItem?.receipt_url) {
        const fileName = targetItem.receipt_url.split('/').pop();
        if (fileName) await supabase.storage.from('receipts').remove([fileName]);
      }
      const { error: deleteError } = await supabase.from('expenses').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setExpenses(expenses.filter(e => e.id !== id));
    } catch (error) {
      console.error('削除処理エラー:', error);
      alert('削除に失敗しました');
    }
  };

  const handleEditClick = (item: Expense) => { 
    if (checkDemo()) return;
    setEditingItem(item); setIsEditOpen(true); 
  };
  const handleUpdateComplete = () => { fetchExpenses(); };
  
  const handleReaction = async (item: Expense, reactionId: string) => {
    if (checkDemo()) return;
    const currentReactions = item.reactions || {};
    const myCurrentReactionId = currentReactions[myUserName];
    const newReactions = { ...currentReactions };
    if (myCurrentReactionId === reactionId) delete newReactions[myUserName]; else newReactions[myUserName] = reactionId;
    setActivePickerId(null);
    const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, reactions: newReactions } : e);
    setExpenses(updatedExpenses);
    await supabase.from('expenses').update({ reactions: newReactions }).eq('id', item.id);
  };

  const handleCommentSubmit = async (item: Expense) => {
    if (checkDemo()) return;
    if (!commentText.trim()) return;
    const newComment: Comment = { id: generateId(), user: myUserName, text: commentText.trim(), timestamp: new Date().toISOString(), };
    const currentComments = item.comments || [];
    const newComments = [...currentComments, newComment];
    const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, comments: newComments } : e);
    setExpenses(updatedExpenses);
    setCommentText('');
    await supabase.from('expenses').update({ comments: newComments }).eq('id', item.id);
  };

  const handleDeleteCommentClick = (item: Expense, commentId: string) => {
    if (checkDemo()) return;
    setModalConfig({ 
      isOpen: true, 
      type: 'confirm', 
      title: 'コメントの削除', 
      message: '本当にこのコメントを削除しますか？', 
      confirmText: '削除する',
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

  const handleStartEditComment = (comment: Comment) => { setEditingCommentId(comment.id); setEditingText(comment.text); };
  const handleSaveEditComment = async (item: Expense) => {
    if (checkDemo()) return;
    if (!editingText.trim() || !editingCommentId) return;
    const currentComments = item.comments || [];
    const newComments = currentComments.map(c => c.id === editingCommentId ? { ...c, text: editingText.trim() } : c);
    const updatedExpenses = expenses.map(e => e.id === item.id ? { ...e, comments: newComments } : e);
    setExpenses(updatedExpenses); setEditingCommentId(null); setEditingText('');
    await supabase.from('expenses').update({ comments: newComments }).eq('id', item.id);
  };
  const formatDate = (dateString: string) => { const d = new Date(dateString); return `${d.getMonth() + 1}/${d.getDate()}`; };

  // おごり・精算済みの切り替え。画面を先に変えて、保存に失敗したら戻す
  const handleToggleFlag = async (item: Expense, key: 'is_excluded' | 'is_settled') => {
    if (checkDemo()) return;
    const next = !item[key];
    setExpenses(prev => prev.map(e => e.id === item.id ? { ...e, [key]: next } : e));
    const { error } = await supabase.from('expenses').update({ [key]: next }).eq('id', item.id);
    if (error) {
      console.error(error);
      setExpenses(prev => prev.map(e => e.id === item.id ? { ...e, [key]: !next } : e));
      alert('更新に失敗しました');
    }
  };

  const handleSettleAllClick = () => {
    if (checkDemo()) return;
    const ids = expenses.filter(e => !e.is_settled).map(e => e.id);
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'まとめて精算済みにする',
      message: `${monthLabel}の未精算の記録 ${ids.length}件を、すべて精算済みにします。`,
      confirmText: '精算済みにする',
      onConfirm: async () => {
        closeModal();
        const { error } = await supabase.from('expenses').update({ is_settled: true }).in('id', ids);
        if (error) { console.error(error); alert('更新に失敗しました'); return; }
        setExpenses(prev => prev.map(e => ids.includes(e.id) ? { ...e, is_settled: true } : e));
      },
    });
  };

  // Calculation
  // おごり(is_excluded)は払った人の自腹扱いなので金額の計算には入れない。
  // 精算済み(is_settled)は途中精算で片付いた分なので、残りの精算額には入れない。
  // ただしカテゴリ別の集計は「使ったお金」なので精算済みも含める。
  // スキャン手当は「記録する手間」へのものなので、おごりも含めて未精算の件数で数える。
  const included = expenses.filter(e => !e.is_excluded);
  const excluded = expenses.filter(e => e.is_excluded);
  const unsettled = included.filter(e => !e.is_settled);
  const settled = included.filter(e => e.is_settled);
  const excludedAmount = excluded.reduce((sum, e) => sum + e.amount, 0);
  const settledAmount = settled.reduce((sum, e) => sum + e.amount, 0);
  const totalMe = unsettled.filter(e => e.paid_by === myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalPartner = unsettled.filter(e => e.paid_by !== myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = totalMe + totalPartner;
  const splitAmount = Math.round(totalAmount / 2); 
  const basicBalance = totalMe - splitAmount; 
  const pending = expenses.filter(e => !e.is_settled);
  const myScanCount = pending.filter(e => e.paid_by === myUserName).length;
  const partnerScanCount = pending.filter(e => e.paid_by !== myUserName).length;
  const scanDiff = myScanCount - partnerScanCount; 
  const scanBonus = scanDiff * SCAN_BONUS_PER_ITEM; 
  const smartBalanceRaw = basicBalance + scanBonus;
  const roundTo100 = (num: number) => { const abs = Math.abs(num); const rounded = Math.floor(abs / 100) * 100; return num >= 0 ? rounded : -rounded; };
  const finalBalance = useSmartSplit ? roundTo100(smartBalanceRaw) : Math.round(basicBalance);
  const monthLabel = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <PageShell isDemoMode={isDemoMode}>
      <Modal isOpen={modalConfig.isOpen} onClose={closeModal} type={modalConfig.type} title={modalConfig.title} message={modalConfig.message} onConfirm={modalConfig.onConfirm} confirmText={modalConfig.confirmText} />
      <EditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} expense={editingItem} onUpdate={handleUpdateComplete} />

      <PageHeader title="精算" subtitle="ふたりの日常の支出を月ごとに精算します" isDemoMode={isDemoMode} />

      <MonthSwitcher month={currentMonth} onChange={(m) => { setCurrentMonth(m); setVisibleCount(10); }} />

      {loading ? <Loading /> : (
        <>
          <SettlementCard
            balance={finalBalance}
            isPaid={monthlyStatus.is_paid}
            isReceived={monthlyStatus.is_received}
            isDemoMode={isDemoMode}
            caption={`${monthLabel}の精算${useSmartSplit ? '（調整済）' : ''}`}
            onStatusClick={handleStatusClick}
            zeroLabel={unsettled.length === 0 && settled.length > 0 ? '精算済み' : '精算なし'}
            rows={[
              { label: settled.length > 0 ? '未精算の割り勘対象' : '割り勘の対象', value: totalAmount },
              { label: '1人あたり (÷2)', value: splitAmount },
              { label: 'あなたの立替', value: totalMe },
              { label: '相手の立替', value: totalPartner },
              { label: '基本の差額', value: basicBalance, signed: true, highlight: !useSmartSplit },
              ...(useSmartSplit ? [{ label: `スキャン手当 (${scanDiff > 0 ? '+' : ''}${scanDiff}回)`, value: scanBonus, signed: true }, { label: '調整後', value: finalBalance, signed: true, highlight: true }] : []),
            ]}
            notes={<>
              {settled.length > 0 && <p>※ 精算済み {settled.length}件（{settledAmount.toLocaleString()}円）は計算に含めていません</p>}
              {excluded.length > 0 && <p>※ おごり {excluded.length}件（{excludedAmount.toLocaleString()}円）は計算に含めていません</p>}
              {useSmartSplit && <p>※ 100円未満を端数調整しています</p>}
            </>}
          />

          {/* スマート精算切り替え */}
          <button onClick={() => setUseSmartSplit(!useSmartSplit)} className="w-full mb-6 bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] flex items-center justify-between gap-3 text-left">
            <span className="flex items-center gap-3">
              <span className={`p-2 rounded-full ${useSmartSplit ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}><Sparkles size={18} /></span>
              <span>
                <span className="block text-sm font-bold text-slate-700">スマート精算</span>
                <span className="block text-[10px] text-slate-400">スキャン手当（1件{SCAN_BONUS_PER_ITEM}円）＆ 100円単位で調整</span>
              </span>
            </span>
            <Toggle checked={useSmartSplit} />
          </button>

          {/* ふたりの立替 */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: 'あなた', total: totalMe, count: myScanCount, dot: 'bg-slate-700' },
              { label: '相手', total: totalPartner, count: partnerScanCount, dot: 'bg-rose-400' },
            ].map((p) => (
              <Card key={p.label} className="p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1"><span className={`w-2 h-2 rounded-full ${p.dot}`}></span>{p.label}の立替</p>
                <p className="text-xl font-black text-slate-800 tabular">¥{p.total.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">未精算 {p.count}件</p>
              </Card>
            ))}
          </div>

          <CategoryBreakdown title="カテゴリ別" items={sumByCategory(included)} />

          <div className="flex items-center justify-between gap-3 mb-3 ml-1">
            <h3 className="font-black text-slate-800 flex items-baseline gap-2 min-w-0 whitespace-nowrap">履歴<span className="text-xs font-bold text-slate-400">{expenses.length}件</span></h3>
            {expenses.some(e => !e.is_settled) && (
              <button onClick={handleSettleAllClick} className="shrink-0 whitespace-nowrap flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-full hover:bg-emerald-50 transition-colors"><CheckCheck size={13} strokeWidth={2.5} />まとめて精算済みに</button>
            )}
          </div>
          {expenses.length === 0 ? (
            <EmptyState icon="🧾" title="この月の記録はまだありません" />
          ) : (
            <>
              <ul className="space-y-3">
                {expenses.slice(0, visibleCount).map((item) => {
                  const isMe = item.paid_by === myUserName;
                  const reactions = item.reactions || {};
                  const reactionEntries = Object.entries(reactions);
                  const comments = item.comments || [];
                  const isCommentOpen = activeCommentId === item.id;
                  const cat = findCategory(item.category);

                  return (
                    <li key={item.id}>
                      <Card className={`p-4 ${item.is_excluded ? '!bg-amber-50/70 !border-amber-100' : item.is_settled ? '!bg-emerald-50/50 !border-emerald-100' : ''}`}>
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-center gap-2.5 min-[360px]:gap-3 min-w-0">
                            <span className="text-xl w-10 h-10 min-[360px]:text-2xl min-[360px]:w-12 min-[360px]:h-12 shrink-0 flex items-center justify-center bg-slate-100 rounded-2xl">{cat.icon}</span>
                            <div className="min-w-0">
                              <div className="flex items-start gap-1.5">
                                <p className="font-black text-slate-800 leading-snug line-clamp-2 [overflow-wrap:anywhere] [line-break:strict]">{item.store_name || '店名なし'}</p>
                                {item.receipt_url && (
                                  <a href={item.receipt_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700 shrink-0" aria-label="レシート画像を開く" onClick={(e) => e.stopPropagation()}>
                                    <Paperclip size={14} />
                                  </a>
                                )}
                              </div>
                              <p className="text-slate-400 text-[11px] font-bold tabular">{formatPurchaseDate(item.purchase_date)}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-black text-lg tabular ${item.is_excluded ? 'text-slate-400 line-through decoration-slate-300' : item.is_settled ? 'text-slate-400' : 'text-slate-800'}`}>¥{item.amount.toLocaleString()}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isMe ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-500'}`}>{item.paid_by}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 mt-3 flex-wrap">
                          {reactionEntries.map(([user, reactionId]) => {
                            const isMyReaction = user === myUserName;
                            const reactionType = REACTION_TYPES.find(r => r.id === reactionId);
                            if (!reactionType) return null;
                            return (
                              <button
                                key={user}
                                onClick={(e) => { e.stopPropagation(); handleReaction(item, reactionId); }}
                                className={`flex items-center gap-1 pl-1.5 pr-2.5 py-1 rounded-full border transition-all ${isMyReaction ? `${reactionType.bg} ${reactionType.border} ${reactionType.text}` : 'bg-white border-slate-200 text-slate-400'}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- 外部の小さな絵文字画像 */}
                                <img src={reactionType.src} alt="" className="w-4 h-4 object-contain" />
                                <span className="text-[10px] font-bold">{user}</span>
                              </button>
                            );
                          })}

                          <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setActivePickerId(activePickerId === item.id ? null : item.id); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors" aria-label="リアクション"><Smile size={16} strokeWidth={2.5} /></button>
                            {activePickerId === item.id && (
                              <div className="absolute left-0 bottom-full mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 flex gap-1 z-30 animate-in">
                                {REACTION_TYPES.map((type) => (
                                  <button key={type.id} onClick={(e) => { e.stopPropagation(); handleReaction(item, type.id); }} className="w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:scale-110 active:scale-95 hover:bg-slate-50">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- 外部の小さな絵文字画像 */}
                                    <img src={type.src} alt={type.id} className="w-7 h-7 object-contain" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button onClick={() => setActiveCommentId(isCommentOpen ? null : item.id)} className={`h-8 min-w-8 px-2 flex items-center justify-center gap-1 rounded-full border transition-colors ${comments.length > 0 ? 'bg-sky-50 border-sky-200 text-sky-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`} aria-label="コメント">
                            <MessageCircle size={16} strokeWidth={2.5} />
                            {comments.length > 0 && <span className="text-[10px] font-bold">{comments.length}</span>}
                          </button>

                        </div>

                        {/* 精算まわりの状態と操作 */}
                        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                          {/* 精算済みはふたりの間のことなので、どちらからでも切り替えられる */}
                          <SettledChip settled={item.is_settled} onClick={() => handleToggleFlag(item, 'is_settled')} />
                          {/* 自腹にするかは払った本人が決める。相手からは表示だけ */}
                          <ExcludedChip excluded={item.is_excluded} onClick={isMe ? () => handleToggleFlag(item, 'is_excluded') : undefined} />

                          {isMe && (
                            <div className="ml-auto flex">
                              <button onClick={() => handleEditClick(item)} className={buttonClass.icon} aria-label="編集"><Pencil size={15} /></button>
                              <button onClick={() => handleDeleteClick(item.id)} className={`${buttonClass.icon} hover:!text-rose-500`} aria-label="削除"><Trash2 size={15} /></button>
                            </div>
                          )}
                        </div>

                        {isCommentOpen && (
                          <div className="comment-area mt-4 pt-4 border-t border-slate-100 animate-in">
                            {comments.length > 0 ? (
                              <ul className="space-y-3 mb-4">
                                {comments.map((comment, i) => {
                                  const isMyComment = comment.user === myUserName;
                                  const isEditing = editingCommentId === comment.id;
                                  return (
                                    <li key={comment.id || i} className={`flex flex-col ${isMyComment ? 'items-end' : 'items-start'}`}>
                                      {isEditing ? (
                                        <div className="w-full flex gap-2 items-end">
                                          <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-slate-200/70 resize-none h-20" />
                                          <div className="flex flex-col gap-1.5">
                                            <button onClick={() => handleSaveEditComment(item)} className="p-2 bg-slate-800 text-white rounded-full" aria-label="保存"><Check size={14} /></button>
                                            <button onClick={() => setEditingCommentId(null)} className="p-2 bg-slate-100 text-slate-500 rounded-full" aria-label="やめる"><X size={14} /></button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed ${isMyComment ? 'bg-slate-800 text-white rounded-br-md' : 'bg-slate-100 text-slate-700 rounded-bl-md'}`}>
                                            {comment.text}
                                          </div>
                                          <div className="flex items-center gap-2 mt-1 px-1">
                                            <span className="text-[10px] font-bold text-slate-400">{comment.user}</span>
                                            <span className="text-[10px] text-slate-300">{formatDate(comment.timestamp)}</span>
                                            {isMyComment && (
                                              <>
                                                <button onClick={() => handleStartEditComment(comment)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600">編集</button>
                                                <button onClick={() => handleDeleteCommentClick(item, comment.id)} className="text-[10px] font-bold text-slate-400 hover:text-rose-500">削除</button>
                                              </>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (<p className="text-xs text-slate-400 text-center mb-4">まだコメントはありません</p>)}
                            <div className="flex gap-2 items-end">
                              <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleCommentSubmit(item); }} placeholder="コメントを入力..." className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-slate-200/70 resize-none h-12 min-h-[48px] max-h-32" />
                              <button onClick={() => handleCommentSubmit(item)} disabled={!commentText.trim()} className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-800 text-white disabled:opacity-40 transition-all active:scale-95" aria-label="送信"><Send size={17} className="ml-0.5" /></button>
                            </div>
                          </div>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
              {expenses.length > visibleCount && (
                <button onClick={() => setVisibleCount(prev => prev + 10)} className={`${buttonClass.secondary} w-full py-3 mt-4 text-xs`}>もっと見る <ChevronDown size={14} /></button>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
