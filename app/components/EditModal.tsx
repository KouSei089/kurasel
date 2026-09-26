'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ExcludedToggle from './ExcludedToggle';
import { Field, CategoryPicker, ChoiceButton, buttonClass, inputClass } from './ui';
import { DAILY_CATEGORIES } from '../lib/categories';

type EditableExpense = { id: number; store_name: string; purchase_date: string; amount: number; category: string | null; paid_by: string; is_excluded?: boolean };

type EditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  expense: EditableExpense | null;
  onUpdate: () => void;
};

export default function EditModal({ isOpen, onClose, expense, onUpdate }: EditModalProps) {
  const [formData, setFormData] = useState({
    store_name: '',
    purchase_date: '',
    amount: 0,
    category: 'food',
    paid_by: '',
    is_excluded: false,
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
        is_excluded: !!target.is_excluded,
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
        is_excluded: formData.is_excluded,
      })
      .eq('id', expense!.id);

    setSaving(false);

    if (error) {
      alert('更新に失敗しました');
    } else {
      onUpdate();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-800">記録の編集</h3>
          <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600">閉じる</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <Field label="店名 / 内容">
            <input value={formData.store_name} onChange={(e) => setFormData({ ...formData, store_name: e.target.value })} className={inputClass} />
          </Field>
          <div className="flex gap-3">
            <Field label="金額 (円)" className="flex-1 min-w-0">
              <input type="number" inputMode="numeric" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })} className={`${inputClass} text-right text-lg font-black tabular`} />
            </Field>
            <Field label="日付" className="w-[46%] shrink-0">
              <input type="date" value={formData.purchase_date} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} className={`${inputClass} !px-3 text-sm h-[54px]`} />
            </Field>
          </div>
          <Field label="カテゴリ">
            <CategoryPicker categories={DAILY_CATEGORIES} value={formData.category} onChange={(category) => setFormData({ ...formData, category })} />
          </Field>
          <Field label="支払った人">
            <div className="grid grid-cols-2 gap-2">
              {users.map((u) => (
                <ChoiceButton key={u.id} selected={formData.paid_by === u.name} onClick={() => setFormData({ ...formData, paid_by: u.name })} className="py-2.5 text-sm font-bold truncate px-2">
                  {u.name}
                </ChoiceButton>
              ))}
            </div>
          </Field>
          <ExcludedToggle value={formData.is_excluded} onChange={(v) => setFormData({ ...formData, is_excluded: v })} />
        </div>

        <div className="flex gap-3 px-6 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
          <button onClick={onClose} className={`${buttonClass.secondary} flex-1 py-3.5`}>キャンセル</button>
          <button onClick={handleSave} disabled={saving} className={`${buttonClass.primary} flex-1 py-3.5`}>{saving ? '保存中...' : '更新する'}</button>
        </div>
      </div>
    </div>
  );
}
