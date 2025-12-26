'use client';
import { useState } from 'react';
import Link from 'next/link';
// ↓ 相対パスでlib/supabaseを読み込み
import { supabase } from './lib/supabase';

export default function Home() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payer, setPayer] = useState<'me' | 'partner'>('me');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result as string;
      
      try {
        const response = await fetch('/api/analyze-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            imageBase64: base64,
            mimeType: file.type 
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
  };

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
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <label className="block mb-4 font-bold text-gray-700">レシートをスキャン</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
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
                  自分
                </button>
                <button
                  onClick={() => setPayer('partner')}
                  className={`py-3 rounded-lg font-bold border-2 transition ${
                    payer === 'partner' 
                      ? 'border-pink-500 bg-pink-50 text-pink-600' 
                      : 'border-gray-200 text-gray-400'
                  }`}
                >
                  パートナー
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