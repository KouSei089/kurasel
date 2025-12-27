'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Webcam from 'react-webcam';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabase';
import Modal from './components/Modal';

// ユーザー情報の型定義
type User = {
  id: number;
  name: string;
};

export default function Home() {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [myUserId, setMyUserId] = useState<string>('');
  const [myUserName, setMyUserName] = useState<string>('');
  
  // ★追加: 登録されている全ユーザーのリスト
  const [userList, setUserList] = useState<User[]>([]);
  
  const [payer, setPayer] = useState<string>(''); 
  const [category, setCategory] = useState<string>('food');
  const [showCamera, setShowCamera] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  // モーダル管理
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'alert' as 'alert' | 'confirm' | 'prompt',
    title: '',
    message: '',
    defaultValue: '',
    onConfirm: (val?: string) => {},
  });

  const openModal = (config: any) => setModalConfig({ ...config, isOpen: true });
  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));

  // ★追加: ユーザー一覧を取得する関数
  const fetchUserList = async () => {
    const { data } = await supabase.from('users').select('id, name').order('id');
    if (data) {
      setUserList(data);
    }
  };

  useEffect(() => {
    const storedId = localStorage.getItem('scan_io_user_id');
    const storedName = localStorage.getItem('scan_io_user_name');
    if (!storedId || !storedName) {
      router.push('/login');
    } else {
      setMyUserId(storedId);
      setMyUserName(storedName);
      setPayer(storedName);
      // 起動時にユーザーリストも取得
      fetchUserList();
    }
  }, [router]);

  const handleRenameClick = () => {
    openModal({
      type: 'prompt',
      title: '名前の変更',
      message: '新しい名前を入力してください',
      defaultValue: myUserName,
      onConfirm: (newName: string) => handleRename(newName),
    });
  };

  const handleRename = async (newName?: string) => {
    if (!newName || newName === myUserName) {
      closeModal();
      return;
    }
    closeModal(); 
    setLoading(true);

    try {
      const { error: userError } = await supabase.from('users').update({ name: newName }).eq('id', myUserId);
      if (userError) throw userError;
      const { error: expenseError } = await supabase.from('expenses').update({ paid_by: newName }).eq('paid_by', myUserName);
      if (expenseError) throw expenseError;

      localStorage.setItem('scan_io_user_name', newName);
      setMyUserName(newName);
      setPayer(newName);
      
      // ★追加: 名前を変えたらリストも再取得して更新
      await fetchUserList();

      setTimeout(() => {
        openModal({ type: 'alert', title: '変更完了', message: `名前を「${newName}」に変更しました`, onConfirm: closeModal });
      }, 300);

    } catch (err) {
      alert("名前の変更に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = () => {
    openModal({
      type: 'confirm',
      title: 'ログアウト',
      message: '本当にログアウトしますか？',
      confirmText: 'ログアウト',
      onConfirm: () => {
        localStorage.clear();
        router.push('/login');
      },
    });
  };

  const handleManualInput = () => {
    setShowCamera(false);
    setLoading(false);
    
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    setResult({
      store: '',
      date: `${yyyy}-${mm}-${dd}`,
      amount: '',
    });
  };

  const analyzeImage = async (base64Data: string, mimeType: string) => {
    setLoading(true);
    setResult(null);
    setShowCamera(false);
    try {
      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data, mimeType: mimeType }),
      });
      const data = await response.json();
      if (data.error) {
        openModal({ type: 'alert', title: 'エラー', message: data.error, onConfirm: closeModal });
      } else {
        setResult(data);
      }
    } catch (err) {
      openModal({ type: 'alert', title: '通信エラー', message: '解析に失敗しました', onConfirm: closeModal });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      await analyzeImage(reader.result as string, file.type);
    };
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) analyzeImage(imageSrc, 'image/jpeg');
  }, [webcamRef]);

  const handleSave = async () => {
    if (!result || !result.amount) {
      openModal({ type: 'alert', title: '入力エラー', message: '金額を入力してください', onConfirm: closeModal });
      return;
    }
    
    setSaving(true);

    const { error } = await supabase
      .from('expenses')
      .insert({
        store_name: result.store || '店名なし',
        amount: result.amount,
        purchase_date: result.date,
        paid_by: payer,
        category: category,
      });

    setSaving(false);

    if (error) {
      console.error(error);
      openModal({ type: 'alert', title: 'エラー', message: '保存に失敗しました', onConfirm: closeModal });
    } else {
      setResult(null);
      openModal({ 
        type: 'alert', 
        title: '保存しました！', 
        message: '記録を保存しました。', 
        confirmText: '閉じる',
        onConfirm: closeModal 
      });
    }
  };

  const categories = [
    { id: 'food', label: '食費', icon: '🥦' },
    { id: 'daily', label: '日用品', icon: '🧻' },
    { id: 'eatout', label: '外食', icon: '🍻' },
    { id: 'transport', label: '交通費', icon: '🚃' },
    { id: 'other', label: 'その他', icon: '📦' },
  ];

  if (!myUserName) return <div className="min-h-screen bg-gray-50"></div>;

  return (
    <div className="p-8 max-w-md mx-auto min-h-screen bg-gray-50 text-gray-800 relative">
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        defaultValue={modalConfig.defaultValue}
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.type === 'confirm' ? modalConfig.title : 'OK'}
      />

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Scan.io</h1>
        <div className="flex gap-2">
          <Link 
            href="/settlement" 
            className="text-sm font-bold text-blue-600 border border-blue-600 px-3 py-1 rounded-full hover:bg-blue-50 transition"
          >
            💰 精算
          </Link>
          <button
             onClick={handleLogoutClick}
             className="text-xs text-gray-400 underline"
          >
            ログアウト
          </button>
        </div>
      </div>
      
      <div className="mb-4 flex items-center gap-2">
        <p className="text-sm font-bold text-gray-600">
          こんにちは、<span className="text-blue-600 text-lg">{myUserName}</span> さん
        </p>
        <button 
          onClick={handleRenameClick}
          className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-gray-600 transition"
        >
          ✏️変更
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h2 className="block mb-4 font-bold text-gray-700">支出を記録</h2>
        {!showCamera ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowCamera(true)}
              className="w-full py-3 bg-blue-50 text-blue-600 font-bold rounded-lg border-2 border-blue-100 hover:bg-blue-100 transition flex items-center justify-center gap-2"
            >
              <span>📸</span> カメラを起動する
            </button>
            
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

            <button
              onClick={handleManualInput}
              className="w-full py-3 bg-white text-gray-600 font-bold rounded-lg border border-gray-200 hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <span>✏️</span> 手入力で記録する
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border-2 border-blue-500 relative bg-black">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                className="w-full h-auto"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCamera(false)} className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg">キャンセル</button>
              <button onClick={capture} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700">撮影する</button>
            </div>
          </div>
        )}
        {loading && <p className="text-center text-blue-500 mt-4 animate-pulse">AIが解析中...</p>}
      </div>

      {result && (
        <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-100 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl font-bold mb-4">内容の確認・編集</h2>
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs text-gray-500 block">店名</label>
              <input 
                value={result.store} 
                onChange={(e) => setResult({...result, store: e.target.value})} 
                placeholder="店名を入力"
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
                  placeholder="0"
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
                    className={`px-3 py-2 rounded-lg text-sm font-bold border transition ${category === cat.id ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-white border-gray-200 text-gray-500'}`}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* ★変更: 支払った人をプルダウン(select)に変更 */}
            <div className="pt-2">
              <label className="text-xs text-gray-500 block mb-2">支払った人</label>
              <div className="relative">
                <select
                  value={payer}
                  onChange={(e) => setPayer(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-bold appearance-none focus:outline-none focus:border-blue-500"
                >
                  {userList.map((user) => (
                    <option key={user.id} value={user.name}>
                      {user.name}
                    </option>
                  ))}
                </select>
                {/* 下矢印アイコン */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            </div>

          </div>
          <button onClick={handleSave} disabled={saving} className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition disabled:bg-gray-400 shadow-md">
            {saving ? '保存中...' : '記録する'}
          </button>
        </div>
      )}
    </div>
  );
}