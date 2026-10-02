-- ============================================================
-- Google ログイン以前のデータを引き継ぐ（1回だけ実行）
--
-- 以前は名前だけでユーザーを区別していた（users テーブル）。
-- その名前で記録された支出・コメント・リアクション・個人の記録を、
-- Google でログインしたふたりのアカウントと、ふたりの世帯に付け替える。
--
-- 手順:
--   1. schema.sql を実行し、新しいアプリを公開する
--   2. ふたりとも新しいアプリで一度 Google ログインする（「はじめる」画面は押さずに閉じてよい）
--   3. 下の4つの値を書き換えて、Supabase の SQL Editor で実行する
--   4. アプリを開き直す
--
-- 何度実行しても同じ結果になる（名前のまま残っている記録だけを付け替える）。
-- どちらかがすでに世帯を作っていれば、その世帯にまとめる
-- ============================================================

do $$
declare
  -- ▼ ここを書き換える
  a_email text := 'person-a@example.com';  -- Aさんが Google ログインに使ったメールアドレス
  a_name  text := 'Aさんの以前の名前';        -- 以前のアプリで選んでいた名前（users.name）
  b_email text := 'person-b@example.com';
  b_name  text := 'Bさんの以前の名前';
  -- ▲ ここまで

  a_id uuid;
  b_id uuid;
  a_household uuid;
  b_household uuid;
  hid uuid;
begin
  select id into a_id from auth.users where lower(email) = lower(a_email);
  select id into b_id from auth.users where lower(email) = lower(b_email);
  if a_id is null then raise exception '% のアカウントが見つかりません。先に一度ログインしてください', a_email; end if;
  if b_id is null then raise exception '% のアカウントが見つかりません。先に一度ログインしてください', b_email; end if;
  if a_id = b_id then raise exception 'ふたりのメールアドレスが同じです'; end if;

  select household_id into a_household from public.household_members where user_id = a_id;
  select household_id into b_household from public.household_members where user_id = b_id;
  if a_household is not null and b_household is not null and a_household <> b_household then
    raise exception 'ふたりが別々の世帯に入っています。片方の世帯を消してからやり直してください';
  end if;

  hid := coalesce(a_household, b_household);
  if hid is null then
    insert into public.households default values returning id into hid;
  end if;

  insert into public.household_members (user_id, household_id, display_name)
  values (a_id, hid, a_name), (b_id, hid, b_name)
  on conflict (user_id) do nothing;

  -- ふたりの記録を世帯に入れる
  update public.expenses set household_id = hid where household_id is null;
  update public.trips set household_id = hid where household_id is null;
  -- 新しいアプリで同じ月の精算状況をもう作っていたら、そちらを残す
  update public.monthly_settlements m set household_id = hid
    where m.household_id is null
      and not exists (select 1 from public.monthly_settlements x where x.household_id = hid and x.month = m.month);

  -- 名前 → ログインユーザーのID
  update public.expenses set paid_by = case paid_by when a_name then a_id::text when b_name then b_id::text end
    where paid_by in (a_name, b_name);
  update public.trip_expenses set paid_by = case paid_by when a_name then a_id::text when b_name then b_id::text end
    where paid_by in (a_name, b_name);
  update public.personal_expenses set owner = case owner when a_name then a_id::text when b_name then b_id::text end
    where owner in (a_name, b_name);
  update public.subscriptions set owner = case owner when a_name then a_id::text when b_name then b_id::text end
    where owner in (a_name, b_name);

  -- リアクションは { 名前: 種類 }、コメントは [{ user: 名前, ... }]
  update public.expenses e set reactions = (
      select coalesce(jsonb_object_agg(case key when a_name then a_id::text when b_name then b_id::text else key end, value), '{}'::jsonb)
      from jsonb_each(e.reactions)
    )
    where e.reactions ?| array[a_name, b_name];

  update public.expenses e set comments = (
      select coalesce(jsonb_agg(
        case c->>'user'
          when a_name then jsonb_set(c, '{user}', to_jsonb(a_id::text))
          when b_name then jsonb_set(c, '{user}', to_jsonb(b_id::text))
          else c
        end order by ord), '[]'::jsonb)
      from jsonb_array_elements(e.comments) with ordinality as t(c, ord)
    )
    where jsonb_typeof(e.comments) = 'array'
      and exists (select 1 from jsonb_array_elements(e.comments) c where c->>'user' in (a_name, b_name));

  raise notice '引き継ぎました（世帯 %）', hid;
end;
$$;
