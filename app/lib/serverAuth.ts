import { createClient } from '@supabase/supabase-js';

// APIルート用。ブラウザから送られてきたログインのトークンを Supabase に確かめる。
// ログインしていない（デモモードを含む）呼び出しには AI を使わせない
export const isSignedIn = async (req: Request) => {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return !error && !!data.user;
};
