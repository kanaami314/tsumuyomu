-- つむよむ: 最初のデータ定義と、行ごとの権限(RLS)
-- 方針は docs/implementation-plan.md の 4 章を参照。

-- ---------------------------------------------------------------
-- 表
-- ---------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  bio text check (char_length(bio) <= 400),
  created_at timestamptz not null default now()
);

create table public.invite_codes (
  code text primary key check (code = upper(code) and char_length(code) >= 8),
  created_by uuid references public.profiles (id) on delete set null,
  max_uses int not null default 1 check (max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  doi text unique,
  arxiv_id text unique,
  title text not null,
  authors text[] not null default '{}',
  year int,
  venue text,
  url text,
  created_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  paper_id uuid not null references public.papers (id),
  status text not null default 'done' check (status in ('want', 'reading', 'done')),
  read_on date,
  depth text check (depth in ('light', 'deep')),
  comment text check (char_length(comment) <= 2000),
  rating int check (rating between 0 and 5),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entries_user_read_on_idx on public.entries (user_id, read_on desc);

create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.shelf_entries (
  shelf_id uuid not null references public.shelves (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  primary key (shelf_id, entry_id)
);

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from public, anon, authenticated;

create trigger entries_touch_updated_at
  before update on public.entries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- 権限
-- ---------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.papers enable row level security;
alter table public.entries enable row level security;
alter table public.shelves enable row level security;
alter table public.shelf_entries enable row level security;

-- 未ログインの人は、どの表にも書き込めない(RLS に加えて、権限の段階でも閉じておく)。
revoke insert, update, delete on all tables in schema public from anon;

-- 招待コードは、画面から直接は読めない。確認は claim_invite() を通す。
revoke all on public.invite_codes from anon, authenticated;

-- プロフィールの作成は claim_invite() だけ。名前(username)の変更は、いまは許さない。
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, bio) on public.profiles to authenticated;

-- 論文の書誌情報は、作ったあとに書き換えさせない(他人の記録を壊せないように)。
revoke update, delete on public.papers from anon, authenticated;

-- プロフィールがある人だけが、書き込める。
create function public.has_profile() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()))
$$;

revoke execute on function public.has_profile() from public, anon;
grant execute on function public.has_profile() to authenticated;

-- profiles: 公開の URL(/u/ユーザー名)に使うので、誰でも読める。自分の表示名と自己紹介だけ変えられる。
create policy profiles_select on public.profiles
  for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- papers: 誰でも読める。書き込みは、プロフィールのある人だけ。
create policy papers_select on public.papers
  for select to anon, authenticated using (true);
create policy papers_insert on public.papers
  for insert to authenticated with check (public.has_profile());

-- entries: 本人は読み書きできる。他の人には、公開のものだけが見える。
create policy entries_select on public.entries
  for select to anon, authenticated
  using (user_id = (select auth.uid()) or visibility = 'public');
create policy entries_insert on public.entries
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_profile());
create policy entries_update on public.entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy entries_delete on public.entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- shelves: entries と同じ。
create policy shelves_select on public.shelves
  for select to anon, authenticated
  using (user_id = (select auth.uid()) or visibility = 'public');
create policy shelves_insert on public.shelves
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_profile());
create policy shelves_update on public.shelves
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy shelves_delete on public.shelves
  for delete to authenticated using (user_id = (select auth.uid()));

-- shelf_entries: 自分の棚に、自分の記録だけを入れられる。
-- 読むときは、棚と記録の両方が見える場合だけ(公開の棚の中の非公開の記録は、他の人には出ない)。
create policy shelf_entries_select on public.shelf_entries
  for select to anon, authenticated
  using (
    exists (select 1 from public.shelves s where s.id = shelf_id)
    and exists (select 1 from public.entries e where e.id = entry_id)
  );
create policy shelf_entries_insert on public.shelf_entries
  for insert to authenticated
  with check (
    exists (select 1 from public.shelves s where s.id = shelf_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()))
  );
create policy shelf_entries_delete on public.shelf_entries
  for delete to authenticated
  using (
    exists (select 1 from public.shelves s where s.id = shelf_id and s.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------
-- 招待コードの使用: コードの確認、ユーザー名の確認、プロフィールの作成を、1回で行う
-- ---------------------------------------------------------------

create function public.claim_invite(p_code text, p_username text)
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code_row public.invite_codes;
  result public.profiles;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  if exists (select 1 from public.profiles where id = uid) then
    raise exception 'already_registered';
  end if;
  if p_username is null or p_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'invalid_username';
  end if;

  -- 同時に使われても回数を超えないように、行をロックして確かめる。
  -- 存在しない・期限切れ・無効・使い切りは、見分けがつかない同じ応答にする。
  select * into code_row
  from public.invite_codes
  where code = upper(btrim(coalesce(p_code, '')))
  for update;

  if not found
     or code_row.disabled
     or (code_row.expires_at is not null and code_row.expires_at <= now())
     or code_row.used_count >= code_row.max_uses then
    raise exception 'invalid_invite';
  end if;

  begin
    insert into public.profiles (id, username) values (uid, p_username)
    returning * into result;
  exception when unique_violation then
    raise exception 'username_taken';
  end;

  update public.invite_codes set used_count = used_count + 1 where code = code_row.code;

  return result;
end;
$$;

revoke execute on function public.claim_invite(text, text) from public, anon;
grant execute on function public.claim_invite(text, text) to authenticated;
