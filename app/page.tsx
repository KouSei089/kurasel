'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Camera, Upload, Check, Loader2, ArrowRight, Receipt, LogOut, User } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import Modal from './components/Modal';

// APIキーの読み込み
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ステート管理
  const [myUserName, setMyUserName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // 保存用にファイルの実体を保持
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  // 入力フォーム
  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('food');

  // モーダル制御
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'confirm' as 'alert' | 'confirm',
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));

  // 初回ロード時のログインチェック
  useEffect(() => {
    const storedName = localStorage.getItem('scan_io_user_name');
    if (!storedName) {
      router.push('/login');
    } else {
      setMyUserName(storedName);
    }
  }, [router]);

  // ログアウトボタンクリック時の処理（モーダルを開く）
  const handleLogoutClick = () => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'ログアウト',
      message: '本当にログアウトしますか？',
      onConfirm: executeLogout,
    });
  };

  // 実際のログアウト処理
  const executeLogout = () => {
    closeModal();
    localStorage.removeItem('scan_io_user_name');
    router.push('/login');
  };

  // ファイル選択時の処理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileToUpload(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    await scanReceipt(file);
  };

  // AIによるレシート解析
  const scanReceipt = async (file: File) => {
    if (!apiKey) {
      alert('APIキーが設定されていません');
      return;
    }

    setIsScanning(true);
    try {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      // 本番環境でも安定して動作するモデルを指定
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
        このレシート画像を解析して、以下の情報をJSON形式で抽出してください。
        キー名は以下のようにしてください:
        - store_name (店名: 文字列)
        - amount (合計金額: 数値)
        - date (日付: YYYY-MM-DD形式)
        - category (カテゴリ: 'food'(食費), 'daily'(日用品), 'eatout'(外食), 'transport'(交通費), 'other'(その他) から推測)
        JSONのみを出力してください。余計なマークダウンは不要です。
      `;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: file.type } },
      ]);

      const responseText = result.response.text();
      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanedText);

      if (data.store_name) setStoreName(data.store_name);
      if (data.amount) setAmount(String(data.amount));
      if (data.date) setPurchaseDate(data.date);
      if (data.category) setCategory(data.category);

    } catch (error) {
      console.error('Scan error:', error);
      alert('解析に失敗しました。手動で入力してください。');
    } finally {
      setIsScanning(false);
    }
  };

  // 画像アップロード処理（Supabase）
  const uploadImageToSupabase = async (file: File) => {
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
      return data.publicUrl;

    } catch (error) {
      console.error('Upload failed:', error);
      return null;
    }
  };

  // 保存ボタンクリック時の処理
  const handleSave = async () => {
    if (!storeName || !amount || !purchaseDate) {
      alert('必須項目を入力してください');
      return;
    }
    setIsSaving(true);
    try {
      let uploadedUrl = null;
      if (fileToUpload) {
        uploadedUrl = await uploadImageToSupabase(fileToUpload);
      }

      const { error } = await supabase.from('expenses').insert({
        store_name: storeName,
        amount: Number(amount),
        purchase_date: purchaseDate,
        paid_by: myUserName,
        category: category,
        receipt_url: uploadedUrl,
      });

      if (error) throw error;
      
      // フォームのリセット
      setStoreName('');
      setAmount('');
      setCategory('food');
      setPreviewUrl(null);
      setFileToUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      alert('記録しました！');

    } catch (error) {
      console.error('Save error:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (!myUserName) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100"></div>;

  return (
    <div className="p-8 max-w-md mx-auto min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 text-gray-700 relative pb-32 font-medium">
      
      {/* 共通モーダル */}
      <Modal 
        isOpen={modalConfig.isOpen} 
        onClose={closeModal} 
        type={modalConfig.type} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        onConfirm={modalConfig.onConfirm} 
        confirmText="ログアウト" 
      />

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-700 drop-shadow-sm flex items-center gap-2">
          Scan.io
        </h1>
        <button 
          onClick={() => router.push('/settlement')}
          className="text-sm font-bold text-slate-600 bg-white/80 backdrop-blur-md border border-white/40 px-5 py-2.5 rounded-full hover:bg-white hover:-translate-y-0.5 transition-all shadow-sm flex items-center gap-2 group"
        >
          <span>精算へ</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-8 relative overflow-hidden text-center group transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.12)]">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/50 to-transparent pointer-events-none"></div>
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        
        {previewUrl ? (
          <div className="relative mb-4">
            <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover rounded-2xl shadow-inner border border-white/60" />
            <button 
              onClick={() => { setPreviewUrl(null); setFileToUpload(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute top-2 right-2 bg-slate-800/80 text-white p-2 rounded-full hover:bg-slate-900 transition-colors backdrop-blur-md"
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <div className="py-10 border-2 border-dashed border-slate-300/70 rounded-2xl mb-4 bg-slate-50/50 flex flex-col items-center justify-center gap-4 transition-colors group-hover:bg-white/60 group-hover:border-slate-400/50">
            <div className="p-4 bg-white rounded-full shadow-sm">
               <Receipt size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm font-bold">レシートを撮影して自動入力</p>
            <div className="flex gap-3 mt-2">
               <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all">
                 <Camera size={16} className="text-blue-500" /> カメラ
               </button>
               <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all">
                 <Upload size={16} className="text-slate-500" /> アップロード
               </button>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-10 animate-in fade-in duration-300">
            <Loader2 className="animate-spin text-blue-500 mb-3" size={40} />
            <p className="font-bold text-slate-600 animate-pulse">AIが解析中...</p>
          </div>
        )}
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/50 to-transparent pointer-events-none"></div>
        <h2 className="text-lg font-black text-slate-700 mb-6 flex items-center gap-2 relative z-10">
          <span className="w-1.5 h-6 bg-slate-700 rounded-full"></span>
          支出の記録
        </h2>

        <div className="space-y-6 relative z-10">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">店名 / 内容</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="コンビニ, スーパーなど"
              className="w-full p-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:bg-white font-bold text-slate-700 placeholder:text-slate-300 transition-all shadow-sm"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">金額 (円)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full p-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:bg-white font-black text-xl text-slate-700 placeholder:text-slate-300 transition-all text-right shadow-sm tracking-tight"
              />
            </div>
            <div className="w-[140px]">
              <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">日付</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full p-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:bg-white font-bold text-slate-600 text-sm h-[60px] shadow-sm text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">カテゴリ</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'food', icon: '🥦', label: '食費' },
                { id: 'daily', icon: '🧻', label: '日用品' },
                { id: 'eatout', icon: '🍻', label: '外食' },
                { id: 'transport', icon: '🚃', label: '交通' },
                { id: 'other', icon: '📦', label: '他' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex flex-col items-center justify-center py-3 rounded-2xl border transition-all active:scale-95 ${
                    category === cat.id
                      ? 'bg-slate-700 text-white border-slate-700 shadow-md transform -translate-y-1'
                      : 'bg-white/60 border-transparent text-slate-400 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <span className="text-xl mb-1 filter drop-shadow-sm">{cat.icon}</span>
                  <span className={`text-[10px] font-bold ${category === cat.id ? 'text-white' : 'text-slate-400'}`}>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="mt-8 w-full py-4 bg-slate-800 text-white font-black text-lg rounded-2xl shadow-lg shadow-slate-300 hover:bg-slate-700 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 relative z-10"
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <Check strokeWidth={3} />}
          <span>記録する</span>
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        {/* ユーザーバッジ */}
        <div className="flex items-center gap-3 pl-2 pr-4 py-1.5 bg-white/60 backdrop-blur-md rounded-full border border-white/40 shadow-sm">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center shadow-inner">
            <User size={16} className="text-slate-500" />
          </div>
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] text-slate-400 font-bold mb-0.5">ログイン中</span>
            <span className="text-sm font-black text-slate-600">{myUserName}</span>
          </div>
        </div>

        {/* ログアウトボタン */}
        <button 
          onClick={handleLogoutClick}
          className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-rose-50"
        >
          <LogOut size={12} />
          ログアウト
        </button>
      </div>
    </div>
  );
}