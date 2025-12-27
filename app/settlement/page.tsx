'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Modal from '../components/Modal'; // ★追加

type Expense = {
  id: number;
  store_name: string;
  amount: number;
  purchase_date: string;
  paid_by: string;
  category: string | null;
};

export default function SettlementPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [myUserName, setMyUserName] = useState<string>('');

  // ★追加: モーダル管理
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'confirm' as 'alert' | 'confirm',
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));
  
  useEffect(() => {
    const storedName = localStorage.getItem('scan_io_user_name');
    if (!storedName) {
      router.push('/login');
    } else {
      setMyUserName(storedName);
    }
  }, [router]);

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
    if (error) console.error(error);
    else setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [currentMonth]);

  const changeMonth = (amount: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + amount);
    setCurrentMonth(newDate);
  };

  // ▼▼▼ 削除処理（モーダル化） ▼▼▼
  const handleDeleteClick = (id: number) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: '記録の削除',
      message: 'この記録を削除してもよろしいですか？',
      onConfirm: () => handleDelete(id),
    });
  };

  const handleDelete = async (id: number) => {
    closeModal(); // 閉じる
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      setExpenses(expenses.filter(e => e.id !== id));
    } else {
      alert('削除に失敗しました');
    }
  };

  const totalMe = expenses.filter(e => e.paid_by === myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalPartner = expenses.filter(e => e.paid_by !== myUserName).reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = totalMe + totalPartner;
  const splitAmount = Math.round(totalAmount / 2);
  const balance = totalMe - splitAmount;
  const monthLabel = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  if (!myUserName) return <div className="min-h-screen bg-gray-50"></div>;

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen bg-gray-50 text-gray-800 relative">
      {/* ★追加: モーダル */}
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        confirmText="削除する"
      />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">精算</h1>
        <button onClick={() => window.location.href = '/'} className="text-sm text-blue-600 underline bg-transparent border-none cursor-pointer">← 入力に戻る</button>
      </div>

      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full">◀︎ 先月</button>
        <span className="font-bold text-lg text-gray-700">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full">次月 ▶︎</button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500 animate-pulse">読み込み中...</div>
      ) : (
        <>
          <div className={`p-6 rounded-xl text-white shadow-lg mb-8 transition-colors ${balance === 0 ? 'bg-gray-500' : balance > 0 ? 'bg-blue-600' : 'bg-pink-600'}`}>
            <p className="text-sm opacity-90 mb-1">{monthLabel}の精算</p>
            <h2 className="text-3xl font-bold mb-2">
              {balance === 0 ? '精算なし' : (
                <>相手{balance > 0 ? 'から' : 'へ'}<span className="text-4xl mx-2 underline">{Math.abs(balance).toLocaleString()}</span>円{balance > 0 ? 'もらう' : '払う'}</>
              )}
            </h2>
            <p className="text-xs opacity-80 text-right">(合計: {totalAmount.toLocaleString()}円 / 2 = {splitAmount.toLocaleString()}円ずつ)</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8">
            <h3 className="font-bold mb-4 border-b pb-2 text-sm text-gray-500">内訳</h3>
            <div className="flex justify-between mb-2">
              <span className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>あなた ({myUserName})</span>
              <span className="font-bold">{totalMe.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center"><span className="w-3 h-3 bg-pink-500 rounded-full mr-2"></span>相手</span>
              <span className="font-bold text-pink-600">{totalPartner.toLocaleString()}円</span>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-4 text-gray-500 text-sm">{monthLabel}の履歴 ({expenses.length}件)</h3>
            {expenses.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">データがありません</p>
            ) : (
              <ul className="space-y-3 pb-10">
                {expenses.map((item) => {
                  const isMe = item.paid_by === myUserName;
                  return (
                    <li key={item.id} className="bg-white p-3 rounded-lg shadow-sm flex justify-between items-center text-sm border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl bg-gray-50 p-2 rounded-lg">{getCategoryIcon(item.category)}</span>
                        <div>
                          <p className="font-bold text-gray-800">{item.store_name || '店名なし'}</p>
                          <p className="text-gray-400 text-xs">{item.purchase_date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-lg">¥{item.amount.toLocaleString()}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${isMe ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>{item.paid_by}</span>
                        </div>
                        {/* ★変更: 削除ボタンでモーダルを開く */}
                        <button onClick={() => handleDeleteClick(item.id)} className="text-gray-300 hover:text-red-500 p-2">🗑️</button>
                      </div>
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