'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Webcam from 'react-webcam'; // ★追加
import { supabase } from './lib/supabase';

export default function Home() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payer, setPayer] = useState<'me' | 'partner'>('me');
  const [category, setCategory] = useState<string>('food');
  
  // ★追加: カメラの制御用
  const [showCamera, setShowCamera] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  // 共通のAI解析処理関数
  const analyzeImage = async (base64Data: string, mimeType: string) => {
    setLoading(true);
    setResult(null);
    setShowCamera(false); // カメラが開いていたら閉じる

    try {
      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: base64Data, // data:image/jpeg;base64,... の形式
          mimeType: mimeType 
        }),
      });

      const data = await response.json();
      if (data.error) {
        alert("エラー: " + data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      alert("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // ファイル選択時の処理 (スマホ/PCのファイルアップロード)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result as string;
      await analyzeImage(base64, file.type);
    };
  };

  // ★追加: Webカメラでの撮影処理
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      // imageSrc は "data:image/jpeg;base64,..." の形式で返ってくる
      analyzeImage(imageSrc, 'image/jpeg');
    }
  }, [webcamRef]);

  // 保存処理
  const handleSave = async () => {
    if (!result) return;
    setSaving(true);

    const { error } = await supabase
      .from('expenses')
      .insert({
        store_name: result.store,
        amount: result.amount,
        purchase_date: result.date,
        paid_by: payer,
        category: category,
      });

    setSaving(false);

    if (error) {
      console.error(error);
      alert('保存に失敗しました: ' + error.message);
    } else {
      alert('保存しました！');
      setResult(null);
    }
  };

  // カテゴリ定義
  const categories = [
    { id: 'food', label: '食費', icon: '🥦' },
    { id: 'daily', label: '日用品', icon: '🧻' },
    { id: 'eatout', label: '外食', icon: '🍻' },
    { id: 'transport', label: '交通費', icon: '🚃' },
    { id: 'other', label: 'その他', icon: '📦' },
  ];

  return (
    <div className="p-8 max-w-md mx-auto min-h-screen bg-gray-50 text-gray-800">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Scan.io</h1>
        <Link 
          href="/settlement" 
          className="text-sm font-bold text-blue-600 border border-blue-600 px-3 py-1 rounded-full hover:bg-blue-50 transition"
        >
          💰 精算を見る
        </Link>
      </div>
      
      {/* 入力エリア */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h2 className="block mb-4 font-bold text-gray-700">レシートをスキャン</h2>
        
        {/* ★追加: カメラモードとファイルモードの切り替え */}
        {!showCamera ? (
          <div className="space-y-4">
            {/* PC向け: カメラ起動ボタン */}
            <button
              onClick={() => setShowCamera(true)}
              className="w-full py-3 bg-blue-50 text-blue-600 font-bold rounded-lg border-2 border-blue-100 hover:bg-blue-100 transition flex items-center justify-center gap-2"
            >
              <span>📸</span> カメラを起動する
            </button>

            {/* スマホ向け/ファイルアップロード */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-full py-3 bg-gray-50 text-gray-500 font-bold rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-100 transition flex items-center justify-center gap-2">
                <span>📂</span> ファイルを選択 / スマホカメラ
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* カメラ映像エリア */}
            <div className="rounded-lg overflow-hidden border-2 border-blue-500 relative bg-black">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }} // スマホなら背面、PCならWebcam
                className="w-full h-auto"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCamera(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={capture}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700"
              >
                撮影する
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-center text-blue-500 mt-4 animate-pulse">AIが解析中...</p>}
      </div>

      {result && (
        <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-100 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl font-bold mb-4">読み取り結果</h2>
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs text-gray-500 block">店名</label>
              <input 
                value={result.store} 
                onChange={(e) => setResult({...result, store: e.target.value})}
                className="w-full text-lg font-bold border-b border-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block">日付</label>
              <input 
                value={result.date} 
                type="date"
                onChange={(e) => setResult({...result, date: e.target.value})}
                className="w-full text-lg border-b border-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block">金額</label>
              <div className="flex items-end">
                <span className="text-lg mr-1">¥</span>
                <input 
                  value={result.amount} 
                  type="number"
                  onChange={(e) => setResult({...result, amount: Number(e.target.value)})}
                  className="w-full text-2xl font-bold text-blue-600 border-b border-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs text-gray-500 block mb-2">カテゴリ</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-bold border transition ${
                      category === cat.id
                        ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs text-gray-500 block mb-2">支払った人</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPayer('me')}
                  className={`py-3 rounded-lg font-bold border-2 transition ${
                    payer === 'me' 
                      ? 'border-blue-500 bg-blue-50 text-blue-600' 
                      : 'border-gray-200 text-gray-400'
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => setPayer('partner')}
                  className={`py-3 rounded-lg font-bold border-2 transition ${
                    payer === 'partner' 
                      ? 'border-pink-500 bg-pink-50 text-pink-600' 
                      : 'border-gray-200 text-gray-400'
                  }`}
                >
                  B
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition disabled:bg-gray-400 shadow-md"
          >
            {saving ? '保存中...' : '記録する'}
          </button>
        </div>
      )}
    </div>
  );
}