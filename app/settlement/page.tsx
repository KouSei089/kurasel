'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Expense = {
  id: number;
  store_name: string;
  amount: number;
  purchase_date: string;
  paid_by: 'me' | 'partner' | null;
  category: string | null;
};

export default function SettlementPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('purchase_date', firstDayStr)
      .lte('purchase_date', lastDayStr)
      .order('purchase_date', { ascending: false });

    if (error) alert('データの取得に失敗しました');
    else setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [currentMonth]);

  const changeMonth = (amount: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + amount);
    setCurrentMonth(newDate);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この記録を削除してもよろしいですか？')) return;
    setDeletingId(id);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) alert('削除に失敗しました');
    else setExpenses(expenses.filter(e => e.id !== id));
    setDeletingId(null);
  };

  const totalMe = expenses.filter(e => e.paid_by === 'me').reduce((sum, e) => sum + e.amount, 0);
  const totalPartner = expenses.filter(e => e.paid_by === 'partner').reduce((sum, e) => sum + e.amount, 0);
  const totalAmount = totalMe + totalPartner;
  const splitAmount = Math.round(totalAmount / 2);
  const balance = totalMe - splitAmount;
  const monthLabel = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <div className="max-w-md mx-auto p-6">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-6 mt-2">
          <h1 className="text-2xl font-extrabold text-slate-900">月次レポート</h1>
          <button 
            onClick={() => window.location.href = '/'} 
            className="text-sm font-bold text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-full hover:bg-slate-50 transition-colors"
          >
            ✕ 閉じる
          </button>
        </div>

        {/* 月切り替え */}
        <div className="flex items-center justify-between bg-white p-2 rounded-full shadow-sm border border-slate-100 mb-8">
          <button onClick={() => changeMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition text-slate-400">◀︎</button>
          <span className="font-bold text-lg text-slate-700">{monthLabel}</span>
          <button onClick={() => changeMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition text-slate-400">▶︎</button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
            <p className="text-sm font-bold">読み込み中...</p>
          </div>
        ) : (
          <>
            {/* メインカード（精算結果） */}
            <div className={`
              relative p-8 rounded-3xl text-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] mb-8 overflow-hidden
              ${balance === 0 ? 'bg-slate-500' : balance > 0 ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : 'bg-gradient-to-br from-rose-400 to-rose-600'}
            `}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
              
              <p className="text-indigo-100 text-sm font-bold mb-1 tracking-wide opacity-80">精算結果</p>
              <h2 className="text-3xl font-extrabold mb-4 tracking-tight">
                {balance === 0 ? '精算なし' : (
                  <>
                    {balance > 0 ? 'B' : 'A'}が<br/>
                    <span className="text-5xl inline-block mt-2">¥{Math.abs(balance).toLocaleString()}</span>
                    <span className="text-lg ml-1 font-normal opacity-80">払う</span>
                  </>
                )}
              </h2>
              <div className="border-t border-white/20 pt-4 mt-4 flex justify-between text-xs font-medium opacity-90">
                <span>合計支出: ¥{totalAmount.toLocaleString()}</span>
                <span>一人あたり: ¥{splitAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* 内訳バー */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 mb-8">
              <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">支払いバランス</h3>
              <div className="flex h-4 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div style={{ width: `${totalAmount ? (totalMe / totalAmount) * 100 : 50}%` }} className="bg-indigo-500 transition-all duration-1000 ease-out"></div>
                <div style={{ width: `${totalAmount ? (totalPartner / totalAmount) * 100 : 50}%` }} className="bg-rose-400 transition-all duration-1000 ease-out"></div>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                  <span className="font-bold text-slate-700">A ¥{totalMe.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">B ¥{totalPartner.toLocaleString()}</span>
                  <div className="w-3 h-3 bg-rose-400 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* 履歴リスト */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider ml-2">履歴 ({expenses.length})</h3>
              {expenses.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                  <p className="text-4xl mb-2">🍃</p>
                  <p className="text-slate-400 text-sm font-bold">データがありません</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {expenses.map((item) => (
                    <li key={item.id} className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 flex justify-between items-center transition-transform active:scale-[0.98]">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center bg-slate-50 text-2xl rounded-2xl border border-slate-100">
                          {getCategoryIcon(item.category)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{item.store_name || '店名なし'}</p>
                          <p className="text-slate-400 text-xs mt-0.5 font-medium">{item.purchase_date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-slate-800">¥{item.amount.toLocaleString()}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            item.paid_by === 'me' ? 'bg-indigo-50 text-indigo-600' : 
                            item.paid_by === 'partner' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {item.paid_by === 'me' ? 'A' : item.paid_by === 'partner' ? 'B' : '?'}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
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
    </div>
  );
}