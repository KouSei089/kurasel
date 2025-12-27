'use client';

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
};

import { useState, useEffect } from 'react';

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
}: ModalProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  // モーダルが開くたびに初期値をセットし直す
  useEffect(() => {
    if (isOpen) setInputValue(defaultValue);
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* コンテンツエリア */}
        <div className="p-6 text-center">
          {title && <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>}
          {message && <p className="text-sm text-gray-500 mb-4 whitespace-pre-wrap">{message}</p>}

          {/* Promptタイプの場合の入力欄 */}
          {type === 'prompt' && (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-lg focus:outline-none focus:border-blue-500 bg-gray-50"
              autoFocus
            />
          )}
        </div>

        {/* ボタンエリア */}
        <div className="flex border-t border-gray-100">
          {(type === 'confirm' || type === 'prompt') && (
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 transition border-r border-gray-100"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm(inputValue);
              if (type === 'alert') onClose(); // alertならここで閉じる
            }}
            className={`flex-1 py-3 text-sm font-bold hover:bg-blue-50 transition ${
              type === 'confirm' && title?.includes('削除') ? 'text-red-500' : 'text-blue-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}