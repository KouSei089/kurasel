'use client';
import { useRef } from 'react';
import { Camera, ImageUp, Loader2, X, Receipt } from 'lucide-react';

// レシートの撮影・選択欄。日常と旅行の入力フォームで共通。
// 選び終えたら input を空に戻すので、同じ画像を選び直しても反応する。
export default function ReceiptCapture({ previewUrl, isScanning, onFile, onClear, compact = false }: {
  previewUrl: string | null;
  isScanning: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };

  const buttons = (
    <div className="flex gap-2 w-full">
      <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-bold text-slate-600 flex items-center justify-center gap-2 hover:border-slate-300 transition-all active:scale-95">
        <Camera size={15} className="text-slate-500" /> 撮影
      </button>
      <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-bold text-slate-600 flex items-center justify-center gap-2 hover:border-slate-300 transition-all active:scale-95">
        <ImageUp size={15} className="text-slate-500" /> 画像を選択
      </button>
    </div>
  );

  return (
    <div className="relative mb-5">
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleChange} className="hidden" />
      <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleChange} className="hidden" />

      {previewUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- 手元で選んだ画像のプレビューなので最適化は不要 */}
          <img src={previewUrl} alt="レシートのプレビュー" className={`w-full object-cover rounded-2xl border border-slate-200 ${compact ? 'h-32' : 'h-44'}`} />
          <button type="button" onClick={onClear} className="absolute top-2 right-2 bg-slate-900/60 text-white p-1.5 rounded-full hover:bg-rose-500 transition-colors" aria-label="画像を外す">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      ) : compact ? buttons : (
        <div className="py-7 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60 flex flex-col items-center gap-3">
          <div className="p-3 bg-white rounded-full shadow-sm"><Receipt size={26} className="text-slate-400" /></div>
          <p className="text-slate-500 text-xs font-bold">レシートを撮ると自動で入力します</p>
          <div className="w-full max-w-64">{buttons}</div>
        </div>
      )}

      {isScanning && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-slate-500 mb-2" size={28} />
          <p className="font-bold text-slate-600 text-sm">AIが読み取り中...</p>
        </div>
      )}
    </div>
  );
}
