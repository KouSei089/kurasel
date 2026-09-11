'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabase';
import { Camera, Upload, Check, Loader2, ArrowRight, Receipt, LogOut, User, X } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import Modal from './components/Modal';

export default function Home() {
  const router = useRouter();
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [myUserName, setMyUserName] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false); // ★追加: デモモード判定

  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const [storeName, setStoreName] = useState('');
  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('food');

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'confirm' as 'alert' | 'confirm',
    title: '',
    message: '',
    confirmText: 'OK',
    onConfirm: () => {},
  });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));

  // ★変更: ログイン判定ロジック
  useEffect(() => {
    const mode = localStorage.getItem('kurasel_mode');
    const storedName = localStorage.getItem('scan_io_user_name');

    if (mode === 'demo') {
      setIsDemoMode(true);
      setMyUserName('あなた'); // DEMO時は名前固定
    } else {
      setIsDemoMode(false);
      if (!storedName) {
        router.push('/login');
      } else {
        setMyUserName(storedName);
      }
    }
  }, [router]);

  const handleLogoutClick = () => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'ログアウト',
      message: '本当にログアウトしますか？',
      confirmText: 'ログアウト',
      onConfirm: executeLogout,
    });
  };

  const executeLogout = () => {
    closeModal();
    localStorage.removeItem('scan_io_user_name');
    localStorage.removeItem('kurasel_mode'); // モード設定も削除
    router.push('/login');
  };

  const handleClearImage = () => {
    setPreviewUrl(null);
    setFileToUpload(null);
    if(cameraInputRef.current) cameraInputRef.current.value = '';
    if(galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);

    try {
      let processFile = file;

      // HEIC変換処理
      if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
        try {
          const heic2any = (await import('heic2any')).default;
          const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.7 });
          const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          processFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
        } catch (e) {
          console.error('HEIC変換エラー:', e);
          alert('画像の形式変換に失敗しました。');
          setIsScanning(false);
          return;
        }
      }

      setFileToUpload(processFile);
      const url = URL.createObjectURL(processFile);
      setPreviewUrl(url);
      
      await scanReceipt(processFile);

    } catch (error) {
      console.error('File processing error:', error);
      setIsScanning(false);
    }
  };

  const scanReceipt = async (file: File) => {
    try {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      // Geminiのキーはサーバー側にしか置かないので、APIルート経由で呼ぶ
      const res = await fetch('/api/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data, mimeType: file.type }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '読み取りに失敗しました');

      if (data.store_name) setStoreName(data.store_name);
      if (data.amount) setAmount(String(data.amount));
      if (data.date) setPurchaseDate(data.date);
      if (data.category) setCategory(data.category);

    } catch (error) {
      console.error('Scan error:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const uploadImageToSupabase = async (file: File) => {
    try {
      const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.6 };
      const compressedFile = await imageCompression(file, options);
      const fileExt = 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;
      const { data, error: uploadError } = await supabase.storage.from('receipts').upload(filePath, compressedFile, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Upload failed:', error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!storeName || !amount || !purchaseDate) {
      alert('必須項目を入力してください');
      return;
    }
    setIsSaving(true);

    try {
      // ★追加: DEMOモードなら保存処理をスキップ
      if (isDemoMode) {
        setTimeout(() => {
          setIsSaving(false);
          // フォームリセット
          setStoreName('');
          setAmount('');
          setCategory('food');
          setPreviewUrl(null);
          setFileToUpload(null);
          if(cameraInputRef.current) cameraInputRef.current.value = '';
          if(galleryInputRef.current) galleryInputRef.current.value = '';

          // DEMO用成功メッセージ
          setModalConfig({
            isOpen: true,
            type: 'alert', 
            title: 'DEMO登録完了 ✨',
            message: 'デモモードのためデータは保存されませんが、\n正常に動作することを確認しました！',
            confirmText: 'OK',
            onConfirm: () => closeModal(),
          });
        }, 1000); // 少し待って保存した感を出す
        return;
      }

      // --- 本番用の保存処理 ---
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
      
      setStoreName('');
      setAmount('');
      setCategory('food');
      setPreviewUrl(null);
      setFileToUpload(null);
      
      if(cameraInputRef.current) cameraInputRef.current.value = '';
      if(galleryInputRef.current) galleryInputRef.current.value = '';
      
      setModalConfig({
        isOpen: true,
        type: 'alert', 
        title: '登録完了 ✨',
        message: '支出を記録しました！',
        confirmText: 'OK',
        onConfirm: () => closeModal(),
      });

    } catch (error) {
      console.error('Save error:', error);
      alert('保存に失敗しました');
    } finally {
      // DEMOモードの場合はsetTimeout内でfalseにするので、ここは本番時のみ有効
      if (!isDemoMode) setIsSaving(false);
    }
  };

  if (!myUserName && !isDemoMode) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100"></div>;

  return (
    <div className={`px-4 py-6 sm:p-8 max-w-md mx-auto min-h-screen text-gray-700 relative pb-32 font-medium transition-colors duration-500 ${isDemoMode ? 'bg-orange-50/50' : 'bg-gradient-to-br from-slate-50 to-gray-100'}`}>
      
      {/* ★追加: DEMOモード時の帯表示 */}
      {isDemoMode && (
        <div className="fixed top-0 left-0 w-full bg-orange-400 text-white text-xs font-bold text-center py-1 z-50 shadow-md">
          🚧 DEMO MODE - データは保存されません
        </div>
      )}

      <Modal 
        isOpen={modalConfig.isOpen} 
        onClose={closeModal} 
        type={modalConfig.type} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        onConfirm={modalConfig.onConfirm} 
        confirmText={modalConfig.confirmText} 
      />

      <div className="flex justify-between items-center mb-6 sm:mb-8 mt-4">
        <h1 className="text-xl sm:text-2xl font-black text-slate-700 tracking-tight flex items-center gap-2">
          レシートスキャン
          {isDemoMode && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full border border-orange-200">DEMO</span>}
        </h1>

        <button onClick={() => router.push('/settlement')} className="text-xs sm:text-sm font-bold text-slate-600 bg-white/80 backdrop-blur-md border border-white/40 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full hover:bg-white hover:-translate-y-0.5 transition-all shadow-sm flex items-center gap-2 group">
          <span>精算へ</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-6 sm:mb-8 relative overflow-hidden text-center group transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.12)]">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/50 to-transparent pointer-events-none"></div>
        
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={cameraInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
        <input 
          type="file" 
          accept="image/*" 
          ref={galleryInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
        
        {previewUrl ? (
          <div className="relative mb-4 group/preview">
            <img src={previewUrl} alt="Preview" className="w-full h-40 sm:h-48 object-cover rounded-2xl shadow-inner border border-white/60" />
            <button 
              onClick={handleClearImage} 
              className="absolute top-2 right-2 bg-black/50 text-white/90 p-1.5 rounded-full hover:bg-rose-500 transition-colors backdrop-blur-sm"
              title="画像を削除"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="py-8 sm:py-10 border-2 border-dashed border-slate-300/70 rounded-2xl mb-4 bg-slate-50/50 flex flex-col items-center justify-center gap-4 transition-colors group-hover:bg-white/60 group-hover:border-slate-400/50">
            <div className="p-3 sm:p-4 bg-white rounded-full shadow-sm"><Receipt size={28} className="text-slate-400 sm:w-8 sm:h-8" /></div>
            <p className="text-slate-500 text-xs sm:text-sm font-bold">レシートを撮影して自動入力</p>
            <div className="flex gap-2 sm:gap-3 mt-2">
               <button onClick={() => cameraInputRef.current?.click()} className="px-4 py-2 sm:px-5 sm:py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all"><Camera size={14} className="text-blue-500 sm:w-4 sm:h-4" /> カメラ</button>
               <button onClick={() => galleryInputRef.current?.click()} className="px-4 py-2 sm:px-5 sm:py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-bold text-slate-600 flex items-center gap-2 hover:bg-slate-50 transition-all"><Upload size={14} className="text-slate-500 sm:w-4 sm:h-4" /> 選択</button>
            </div>
          </div>
        )}
        
        {isScanning && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-10 animate-in fade-in duration-200">
            <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
            <p className="font-bold text-slate-600 text-sm animate-pulse">AIが解析中...</p>
          </div>
        )}
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/40 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/50 to-transparent pointer-events-none"></div>
        <h2 className="text-base sm:text-lg font-black text-slate-700 mb-4 sm:mb-6 flex items-center gap-2 relative z-10"><span className="w-1.5 h-5 sm:h-6 bg-slate-700 rounded-full"></span>支出の記録</h2>
        <div className="space-y-4 sm:space-y-6 relative z-10">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">店名 / 内容</label>
            <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="コンビニ, スーパーなど" className="w-full p-3 sm:p-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:bg-white font-bold text-slate-700 placeholder:text-slate-300 transition-all shadow-sm text-sm sm:text-base" />
          </div>
          <div className="flex gap-3 sm:gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">金額 (円)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full p-3 sm:p-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:bg-white font-black text-lg sm:text-xl text-slate-700 placeholder:text-slate-300 transition-all text-right shadow-sm tracking-tight" />
            </div>
            <div className="w-[35%] min-w-[120px]">
              <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">日付</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full p-3 sm:p-4 rounded-2xl bg-white/60 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:bg-white font-bold text-slate-600 text-xs sm:text-sm h-[52px] sm:h-[60px] shadow-sm text-center" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">カテゴリ</label>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {[{ id: 'food', icon: '🥦', label: '食費' }, { id: 'daily', icon: '🧻', label: '日用品' }, { id: 'eatout', icon: '🍻', label: '外食' }, { id: 'transport', icon: '🚃', label: '交通' }, { id: 'other', icon: '📦', label: '他' }].map((cat) => (
                <button key={cat.id} onClick={() => setCategory(cat.id)} className={`flex flex-col items-center justify-center py-2 sm:py-3 rounded-2xl border transition-all active:scale-95 ${category === cat.id ? 'bg-slate-700 text-white border-slate-700 shadow-md transform -translate-y-1' : 'bg-white/60 border-transparent text-slate-400 hover:bg-white hover:shadow-sm'}`}><span className="text-lg sm:text-xl mb-0.5 sm:mb-1 filter drop-shadow-sm">{cat.icon}</span><span className={`text-[9px] sm:text-[10px] font-bold ${category === cat.id ? 'text-white' : 'text-slate-400'}`}>{cat.label}</span></button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="mt-6 sm:mt-8 w-full py-3 sm:py-4 bg-slate-800 text-white font-black text-base sm:text-lg rounded-2xl shadow-lg shadow-slate-300 hover:bg-slate-700 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 relative z-10">{isSaving ? <Loader2 className="animate-spin" /> : <Check strokeWidth={3} />}<span>記録する</span></button>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="flex items-center gap-3 pl-2 pr-4 py-1.5 bg-white/60 backdrop-blur-md rounded-full border border-white/40 shadow-sm">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center shadow-inner"><User size={16} className="text-slate-500" /></div>
          <div className="flex flex-col items-start leading-none"><span className="text-[10px] text-slate-400 font-bold mb-0.5">ログイン中</span><span className="text-sm font-black text-slate-600">{myUserName}</span></div>
        </div>
        <button onClick={handleLogoutClick} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-rose-50"><LogOut size={12} />ログアウト</button>
      </div>
    </div>
  );
}