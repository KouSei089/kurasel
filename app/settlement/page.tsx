'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // パスが違う場合は修正してください
import Link from 'next/link';

type Expense = {
  id: number;
  store_name: string;
  amount: number;
  purchase_date: string;
  paid_by: 'me' | 'partner' | null;
};

export default function SettlementPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  // 表示中の月（初期値は今日）
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const fetchExpenses = async () => {
    setLoading(true);
    
    // ▼▼▼ 修正箇所: 日本時間のまま検索するように修正 ▼▼▼
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // 日付オブジェクトを "YYYY-MM-DD" 文字列に変換する関数
    const toYMD = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // 月初 (1日) と 月末 (翌月の0日) を取得
    const firstDayStr = toYMD(new Date(year, month, 1));
    const lastDayStr = toYMD(new Date(year, month + 1, 0));
    // ▲▲▲ 修正ここまで ▲▲▲

    console.log(`Searching from ${firstDayStr} to ${lastDayStr}`); // デバッグ用ログ

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('purchase_date', firstDayStr)
      .lte('purchase_date', lastDayStr)
      .order('purchase_date', { ascending: false });

    if (error) {
      console.error(error);
      alert('データの取得に失敗しました');
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  };

  // 月が変わるたびに再取得
  useEffect(() => {
    fetchExpenses();
  }, [currentMonth]);

  // 月切り替えボタンの処理
  const changeMonth = (amount: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + amount);
    setCurrentMonth(newDate);
  };

  // 削除ボタンの処理
  const handleDelete = async (id: number) => {
    if (!confirm('この記録を削除してもよろしいですか？')) return;
    
    setDeletingId(id);
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) {
      alert('削除に失敗しました');
    } else {
      setExpenses(expenses.filter(e => e.id !== id));
    }
    setDeletingId(null);
  };

  // 集計ロジック
  const totalMe = expenses
    .filter(e => e.paid_by === 'me')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalPartner = expenses
    .filter(e => e.paid_by === 'partner')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalAmount = totalMe + totalPartner;
  const splitAmount = Math.round(totalAmount / 2);
  const balance = totalMe - splitAmount; 

  const monthLabel = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen bg-gray-50 text-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">精算</h1>
        <button 
            onClick={() => window.location.href = '/'} 
            className="text-sm text-blue-600 underline bg-transparent border-none cursor-pointer"
            >
            ← 入力に戻る
        </button>
      </div>

      {/* 月切り替えエリア */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <button 
          onClick={() => changeMonth(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition select-none"
        >
          ◀︎ 先月
        </button>
        <span className="font-bold text-lg text-gray-700">{monthLabel}</span>
        <button 
          onClick={() => changeMonth(1)}
          className="p-2 hover:bg-gray-100 rounded-full transition select-none"
        >
          次月 ▶︎
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500 animate-pulse">読み込み中...</div>
      ) : (
        <>
          {/* 精算結果カード */}
          <div className={`p-6 rounded-xl text-white shadow-lg mb-8 transition-colors ${
            balance === 0 ? 'bg-gray-500' : balance > 0 ? 'bg-blue-600' : 'bg-pink-600'
          }`}>
            <p className="text-sm opacity-90 mb-1">{monthLabel}の精算</p>
            <h2 className="text-3xl font-bold mb-2">
              {balance === 0 ? '精算なし' : (
                <>
                  {balance > 0 ? 'パートナー' : 'あなた'}が
                  <span className="text-4xl mx-2 underline">{Math.abs(balance).toLocaleString()}</span>
                  円払う
                </>
              )}
            </h2>
            <p className="text-xs opacity-80 text-right">
              (合計: {totalAmount.toLocaleString()}円 / 2 = {splitAmount.toLocaleString()}円ずつ)
            </p>
          </div>

          {/* 内訳 */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8">
            <h3 className="font-bold mb-4 border-b pb-2 text-sm text-gray-500">内訳</h3>
            <div className="flex justify-between mb-2">
              <span className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>自分</span>
              <span className="font-bold">{totalMe.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center"><span className="w-3 h-3 bg-pink-500 rounded-full mr-2"></span>パートナー</span>
              <span className="font-bold">{totalPartner.toLocaleString()}円</span>
            </div>
          </div>

          {/* 履歴リスト */}
          <div>
            <h3 className="font-bold mb-4 text-gray-500 text-sm">{monthLabel}の履歴 ({expenses.length}件)</h3>
            {expenses.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">この月のデータはありません</p>
            ) : (
              <ul className="space-y-3 pb-10">
                {expenses.map((item) => (
                  <li key={item.id} className="bg-white p-3 rounded-lg shadow-sm flex justify-between items-center text-sm border border-gray-100 group">
                    <div>
                      <p className="font-bold text-gray-800">{item.store_name || '店名なし'}</p>
                      <p className="text-gray-400 text-xs">{item.purchase_date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-lg">¥{item.amount.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.paid_by === 'me' ? 'bg-blue-100 text-blue-600' : 
                          item.paid_by === 'partner' ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.paid_by === 'me' ? '自分' : item.paid_by === 'partner' ? 'パートナー' : '未設定'}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="text-gray-300 hover:text-red-500 p-2 transition-colors"
                      >
                        {deletingId === item.id ? '...' : '🗑️'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}