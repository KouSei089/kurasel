import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("❌ .env.local に SupabaseのURLとキーが設定されていません");
}

// ログインの状態はブラウザ（localStorage）に持つ。
// Google から戻ってきたときの ?code= は、ここで作ったクライアントが読み取ってログインを完了する
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

// Google ログイン。戻り先は同じアプリ内のページ（Supabase の Redirect URLs に登録が必要）
export const signInWithGoogle = (returnPath: string) =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${returnPath}` },
  });

// 世帯まわりの関数（supabase/schema.sql）が返すエラーを画面の文言にする
export const householdErrorMessage = (error: { message?: string } | null) => {
  const message = error?.message ?? '';
  if (message.includes('invalid_invite')) return '招待コードが違うか、期限が切れています。相手にもう一度発行してもらってください';
  if (message.includes('household_full')) return 'この家計にはすでにふたりが参加しています';
  if (message.includes('already_member')) return 'すでに家計に参加しています';
  if (message.includes('name_required')) return '表示名を入力してください';
  return 'うまくいきませんでした。時間をおいてもう一度お試しください';
};
