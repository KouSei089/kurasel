'use client';
import { useState } from 'react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  type?: 'alert' | 'confirm' | 'prompt'; // アラート、確認、入力
  confirmText?: string;
  cancelText?: string;
  onConfirm: (inputValue?: string) => void;
  defaultValue?: string; // prompt用の初期値
  inputMode?: 'text' | 'numeric'; // prompt の入力欄。numeric だと iPhone で数字キーボードになる
  placeholder?: string;
};

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = 'alert',
  confirmText = 'OK',
  cancelText = 'キャンセル',
  onConfirm,
  defaultValue = '',
  inputMode = 'text',
  placeholder,
}: ModalProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  // モーダルが開くたびに初期値をセットし直す。
  // useEffect内でsetStateすると余計な再レンダリングが1往復増えるため、
  // Reactが推奨するレンダリング中の状態調整で行う。
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setInputValue(defaultValue);
  }

  if (!isOpen) return null;

  // 削除・取り消しなど元に戻せない操作は赤で出す
  const isDanger = type === 'confirm' && /削除|取り消/.test(`${title}${confirmText}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={type === 'alert' ? undefined : onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs max-h-full overflow-y-auto animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-5 text-center">
          {title && <h3 className="text-lg font-black text-slate-800 mb-2">{title}</h3>}
          {message && <p className="text-sm text-slate-500 whitespace-pre-wrap leading-relaxed">{message}</p>}

          {type === 'prompt' && (
            <input
              type="text"
              inputMode={inputMode}
              placeholder={placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full mt-3 px-4 py-3 rounded-2xl bg-white border border-slate-200 font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-200/70"
              autoFocus
            />
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          {(type === 'confirm' || type === 'prompt') && (
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition">
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm(inputValue);
              if (type === 'alert') onClose(); // alertならここで閉じる
            }}
            className={`flex-1 py-3 rounded-2xl text-sm font-bold text-white transition ${isDanger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
