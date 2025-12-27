'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

type User = {
  id: number;
  name: string;
};

export default function LoginPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // ユーザー一覧を取得
  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*').order('id');
    if (error) {
      console.error(error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 新規ユーザー登録（最大2名まで）
  const handleRegister = async () => {
    if (!newName.trim()) return;
    
    const { error } = await supabase.from('users').insert({ name: newName });
    if (error) {
      alert('登録に失敗しました（同じ名前は使えません）');
    } else {
      setNewName('');
      fetchUsers();
    }
  };

  // ログイン処理（ローカルストレージに名前を保存）
  const handleLogin = (user: User) => {
    localStorage.setItem('scan_io_user_id', user.id.toString());
    localStorage.setItem('scan_io_user_name', user.name);
    router.push('/'); // トップページへ移動
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-gray-800">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">利用者を選択</h1>

        {loading ? (
          <p className="text-center">読み込み中...</p>
        ) : (
          <div className="space-y-4">
            {/* 登録済みのユーザーボタン */}
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleLogin(user)}
                className="w-full py-4 text-lg font-bold bg-blue-50 text-blue-600 border-2 border-blue-100 rounded-xl hover:bg-blue-100 transition flex items-center justify-center"
              >
                {user.name} として利用
              </button>
            ))}

            {/* 2名未満なら登録フォームを表示 */}
            {users.length < 2 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-2">
                  {users.length === 0 ? 'まずは1人目を登録' : 'パートナーを登録'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="名前を入力 (例: Taro)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleRegister}
                    disabled={!newName}
                    className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold disabled:bg-gray-400"
                  >
                    登録
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}