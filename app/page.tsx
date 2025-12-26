'use client';
import { useState } from 'react';

export default function Home() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ファイルを選択してAPIに送信する関数
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result as string;
      
      // ★ここが修正ポイント: 画像のタイプ（image/jpegなど）も一緒に送る
      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: base64,
          mimeType: file.type // ← ここを追加！
        }),
      });

      const data = await response.json();
      if (data.error) {
          alert("エラーが発生しました: " + data.error);
      } else {
          setResult(data);
      }
      setLoading(false);
    };
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">レシート読み取りテスト</h1>
      
      {/* カメラ起動/ファイル選択ボタン */}
      <input
        type="file"
        accept="image/*"
        capture="environment" // スマホでカメラを優先起動
        onChange={handleFileChange}
        className="block w-full text-sm text-slate-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-violet-50 file:text-violet-700
          hover:file:bg-violet-100 mb-4"
      />

      {/* 読み取り中表示 */}
      {loading && <p className="text-blue-500">解析中... AIがレシートを読んでいます</p>}

      {/* 結果表示 */}
      {result && (
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="font-bold mb-2">読み取り結果:</h2>
          <p>📍 店名: {result.store}</p>
          <p>📅 日付: {result.date}</p>
          <p>💰 金額: {result.amount}円</p>
        </div>
      )}
    </div>
  );
}