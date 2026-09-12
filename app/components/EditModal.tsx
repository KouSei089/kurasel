'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type EditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  expense: any;
  onUpdate: () => void;
};

export default function EditModal({ isOpen, onClose, expense, onUpdate }: EditModalProps) {
  const [formData, setFormData] = useState({
    store_name: '',
    purchase_date: '',
    amount: 0,
    category: 'food',
    paid_by: '',
  });
  const [users, setUsers] = useState<{id: number, name: string}[]>([]);
  const [saving, setSaving] = useState(false);

  // 開いた対象が変わったらフォームを入れ直す。
  // useEffect内でsetStateすると再レンダリングが1往復増えるため、
  // Reactが推奨するレンダリング中の状態調整で行う。
  const target = isOpen && expense ? expense : null;
  const [prevTarget, setPrevTarget] = useState(target);
  if (target !== prevTarget) {
    setPrevTarget(target);
    if (target) {
      setFormData({
        store_name: target.store_name,
        purchase_date: target.purchase_date,
        amount: target.amount,
        category: target.category || 'food',
        paid_by: target.paid_by,
      });
    }
  }

  // ユーザー一覧の取得は外部への問い合わせなのでeffectのまま
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    supabase.from('users').select('id, name').order('id').then(({ data }) => {
      if (!cancelled && data) setUsers(data);
    });
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('expenses')
      .update({
        store_name: formData.store_name,
        amount: formData.amount,
        purchase_date: formData.purchase_date,
        category: formData.category,
        paid_by: formData.paid_by,
      })
      .eq('id', expense.id);

    setSaving(false);

    if (error) {
      alert('更新に失敗しました');
    } else {
      onUpdate();
      onClose();
    }
  };

  if (!isOpen) return null;

  const categories = [
    { id: 'food', label: '食費', icon: '🥦' },
    { id: 'daily', label: '日用品', icon: '🧻' },
    { id: 'eatout', label: '外食', icon: '🍻' },
    { id: 'transport', label: '交通費', icon: '🚃' },
    { id: 'other', label: 'その他', icon: '📦' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-xl animate-in zoom-in-95 duration-200 max-h-full overflow-y-auto">
        <h3 className="text-xl font-bold mb-6 text-gray-800">記録の編集</h3>
        
        <div className="space-y-6">
          <div>
            <label className="text-sm text-gray-500 block mb-1">店名</label>
            <input
              value={formData.store_name}
              onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
              className="w-full border-b border-gray-100 py-2 font-bold focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">日付</label>
            <input
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              className="w-full border-b border-gray-100 py-2 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">金額</label>
            <div className="flex items-end">
              <span className="text-lg mr-2">¥</span>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full border-b border-gray-100 py-2 text-2xl font-bold text-blue-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-500 block mb-3">カテゴリ</label>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFormData({ ...formData, category: cat.id })}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold border transition ${
                    formData.category === cat.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 block mb-3">支払った人</label>
            <div className="relative">
              <select
                value={formData.paid_by}
                onChange={(e) => setFormData({ ...formData, paid_by: e.target.value })}
                className="w-full p-3 bg-gray-50 border-none rounded-xl font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
               <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <button onClick={onClose} className="flex-1 py-4 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition">キャンセル</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-4 bg-blue-600 rounded-xl font-bold text-white shadow-md hover:bg-blue-700 transition">
            {saving ? '保存中...' : '更新'}
          </button>
        </div>
      </div>
    </div>
  );
}