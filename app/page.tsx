'use client';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
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
  const [deletingId, setDeletingId] = useState<number | null>(null); // 削除処理中のID

  // データ取得関数（再利用できるように外に出しました）
  const fetchExpenses = async () => {
    setLoading(true);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('purchase_date', firstDay)
      .lte('purchase_date', lastDay)
      .order('purchase_date', { ascending: false });

    if (error) {
      console.error(error);
      alert('データの取得に失敗しました');
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // ★追加: 削除機能
  const handleDelete = async (id: number) => {
    if (!confirm('この記録を削除してもよろしいですか？')) return;
    
    setDeletingId(id);
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) {
      alert('削除に失敗しました');
      console.error(error);
    } else {
      // 成功したら画面からも消す（再読み込みせずリストから除外）
      setExpenses(expenses.filter(e => e.id !== id));
    }
    setDeletingId(null);
  };

  const totalMe = expenses
    .filter(e => e.paid_by === 'me')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalPartner = expenses
    .filter(e => e.paid_by === 'partner')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalAmount = totalMe + totalPartner;
  const splitAmount = Math.round(totalAmount / 2);
  const balance = totalMe - splitAmount; 

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen bg-gray-50 text-gray-800">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">今月の精算</h1>
        <Link href="/" className="text-sm text-blue-600 underline">
          ← 入力に戻る
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">読み込み中...</div>
      ) : (
        <>
          <div className={`p-6 rounded-xl text-white shadow-lg mb-8 transition-colors ${
            balance === 0 ? 'bg-gray-500' : balance > 0 ? 'bg-blue-600' : 'bg-pink-600'
          }`}>
            <p className="text-sm opacity-90 mb-1">精算結果</p>
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

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8">
            <h3 className="font-bold mb-4 border-b pb-2 text-sm text-gray-500">支払い内訳</h3>
            <div className="flex justify-between mb-2">
              <span className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>自分</span>
              <span className="font-bold">{totalMe.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center"><span className="w-3 h-3 bg-pink-500 rounded-full mr-2"></span>パートナー</span>
              <span className="font-bold">{totalPartner.toLocaleString()}円</span>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-4 text-gray-500 text-sm">今月の履歴 ({expenses.length}件)</h3>
            {expenses.length === 0 ? (
              <p className="text-center text-gray-400 text-sm">データがまだありません</p>
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
                      
                      {/* ★追加: 削除ボタン */}
                      <button 
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="text-gray-300 hover:text-red-500 p-2 transition-colors"
                        title="削除する"
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