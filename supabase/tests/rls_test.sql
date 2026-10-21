-- RLS と招待コードのテスト。失敗すると、その場で止まる。
\set ON_ERROR_STOP on

create schema t;
grant usage on schema t to public;

create function t.as_admin() returns void language sql as $$ select set_config('role', 'postgres', true) $$;
create function t.as_anon() returns void language sql as
  $$ select set_config('role', 'anon', true), set_config('request.jwt.claim.sub', '', true) $$;
create function t.as_user(u uuid) returns void language sql as
  $$ select set_config('role', 'authenticated', true), set_config('request.jwt.claim.sub', u::text, true) $$;

create function t.eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'NG %: got %, want %', label, got, want;
  end if;
  raise notice 'ok %', label;
end;
$$;

-- stmt が、指定の文言を含むエラーで失敗することを確かめる
create function t.throws(label text, stmt text, expected text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'NG %: エラーにならなかった', label;
exception when others then
  if sqlerrm like 'NG %' then raise; end if;
  if sqlerrm not like '%' || expected || '%' then
    raise exception 'NG %: エラーの内容が違う: %', label, sqlerrm;
  end if;
  raise notice 'ok % (%)', label, sqlerrm;
end;
$$;

-- 準備
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');

insert into public.invite_codes (code, max_uses, expires_at, disabled) values
  ('GOODCODE1', 1, null, false),
  ('GOODCODE2', 5, null, false),
  ('EXPIRED01', 5, now() - interval '1 day', false),
  ('DISABLED1', 5, null, true);

-- ---------------------------------------------------------------
-- 招待コード
-- ---------------------------------------------------------------
do $$
declare
  a constant uuid := '00000000-0000-0000-0000-00000000000a';
  b constant uuid := '00000000-0000-0000-0000-00000000000b';
  c constant uuid := '00000000-0000-0000-0000-00000000000c';
begin
  perform t.as_anon();
  perform t.throws('anon は claim_invite を呼べない',
    $q$select public.claim_invite('GOODCODE2', 'anon_user')$q$, 'permission denied');
  perform t.throws('anon は招待コードを読めない', $q$select * from public.invite_codes$q$, 'permission denied');

  perform t.as_user(a);
  perform t.throws('本人でも招待コードの表は読めない', $q$select * from public.invite_codes$q$, 'permission denied');
  perform t.throws('本人でも招待コードを足せない',
    $q$insert into public.invite_codes (code) values ('SELFMADE1')$q$, 'permission denied');
  perform t.throws('ユーザー名の形式が違う', $q$select public.claim_invite('GOODCODE1', 'A!')$q$, 'invalid_username');
  perform t.throws('存在しないコード', $q$select public.claim_invite('NOSUCHCODE', 'alice')$q$, 'invalid_invite');
  perform t.throws('期限切れのコード', $q$select public.claim_invite('EXPIRED01', 'alice')$q$, 'invalid_invite');
  perform t.throws('無効化されたコード', $q$select public.claim_invite('DISABLED1', 'alice')$q$, 'invalid_invite');
  perform t.eq('失敗しても登録されない',
    (select count(*) from public.profiles)::int, 0);

  -- 小文字・前後の空白でも通る
  perform t.eq('登録できる', (public.claim_invite('  goodcode1 ', 'alice')).username, 'alice');
  perform t.throws('登録済みの人は、もう一度できない',
    $q$select public.claim_invite('GOODCODE2', 'alice2')$q$, 'already_registered');

  perform t.as_admin();
  perform t.eq('使用回数が増える',
    (select used_count from public.invite_codes where code = 'GOODCODE1'), 1);

  perform t.as_user(b);
  perform t.throws('使い切ったコード', $q$select public.claim_invite('GOODCODE1', 'bob')$q$, 'invalid_invite');
  perform t.throws('ユーザー名の重複', $q$select public.claim_invite('GOODCODE2', 'alice')$q$, 'username_taken');

  perform t.as_admin();
  perform t.eq('名前の重複では使用回数が増えない',
    (select used_count from public.invite_codes where code = 'GOODCODE2'), 0);

  perform t.as_user(b);
  perform t.eq('別のコードで登録できる', (public.claim_invite('GOODCODE2', 'bob')).username, 'bob');
  perform t.as_admin();
  perform t.eq('回数が増える(2)',
    (select used_count from public.invite_codes where code = 'GOODCODE2'), 1);
end;
$$;

-- ---------------------------------------------------------------
-- プロフィールを持たない人は、何も書けない(c はコードを使っていない)
-- ---------------------------------------------------------------
do $$
declare
  c constant uuid := '00000000-0000-0000-0000-00000000000c';
begin
  perform t.as_user(c);
  perform t.throws('プロフィールなしでは論文を足せない',
    $q$insert into public.papers (doi, title) values ('10.1/none', 'x')$q$, 'row-level security');
  perform t.throws('プロフィールなしでは記録を足せない',
    $q$insert into public.entries (user_id, paper_id) values ('00000000-0000-0000-0000-00000000000c', gen_random_uuid())$q$,
    'violates');
  perform t.throws('プロフィールなしでは棚を作れない',
    $q$insert into public.shelves (user_id, name) values ('00000000-0000-0000-0000-00000000000c', 's')$q$, 'violates');
  perform t.throws('自分でプロフィールを作れない',
    $q$insert into public.profiles (id, username) values ('00000000-0000-0000-0000-00000000000c', 'carol')$q$,
    'permission denied');
end;
$$;

-- ---------------------------------------------------------------
-- 記録と棚: 他人の非公開は読めない・書けない
-- ---------------------------------------------------------------
do $$
declare
  a constant uuid := '00000000-0000-0000-0000-00000000000a';
  b constant uuid := '00000000-0000-0000-0000-00000000000b';
  paper uuid;
  e_priv uuid;
  e_pub uuid;
  shelf_pub uuid;
  shelf_priv uuid;
  n int;
begin
  perform t.as_user(a);
  insert into public.papers (doi, title, authors, year) values ('10.1/p', '論文P', '{"X"}', 2020) returning id into paper;
  insert into public.entries (user_id, paper_id, visibility, comment) values (a, paper, 'private', 'ひみつ') returning id into e_priv;
  insert into public.entries (user_id, paper_id, visibility, comment) values (a, paper, 'public', 'こうかい') returning id into e_pub;
  insert into public.shelves (user_id, name, visibility) values (a, '公開の棚', 'public') returning id into shelf_pub;
  insert into public.shelves (user_id, name) values (a, '非公開の棚') returning id into shelf_priv;
  insert into public.shelf_entries values (shelf_pub, e_priv), (shelf_pub, e_pub), (shelf_priv, e_pub);

  perform t.eq('本人は自分の記録を全部読める', (select count(*) from public.entries)::int, 2);
  perform t.eq('既定は非公開', (select visibility from public.entries where id = e_priv), 'private');

  -- 他のログイン者(b)
  perform t.as_user(b);
  perform t.eq('b には公開の記録だけ見える', (select count(*) from public.entries)::int, 1);
  perform t.eq('b には公開の棚だけ見える', (select count(*) from public.shelves)::int, 1);
  perform t.eq('公開の棚でも非公開の記録は出ない',
    (select count(*) from public.shelf_entries)::int, 1);
  perform t.eq('b は論文の情報を読める', (select count(*) from public.papers)::int, 1);

  update public.entries set comment = '書き換え' where id = e_pub;
  get diagnostics n = row_count;
  perform t.eq('b は a の記録を更新できない', n, 0);
  delete from public.entries where id = e_pub;
  get diagnostics n = row_count;
  perform t.eq('b は a の記録を消せない', n, 0);
  delete from public.shelves where id = shelf_pub;
  get diagnostics n = row_count;
  perform t.eq('b は a の棚を消せない', n, 0);
  perform t.throws('b は a の名前で記録を作れない',
    format($q$insert into public.entries (user_id, paper_id) values (%L, %L)$q$, a, paper), 'row-level security');
  perform t.throws('b は a の棚に記録を入れられない',
    format($q$insert into public.shelf_entries values (%L, %L)$q$, shelf_pub, e_pub), 'row-level security');
  insert into public.shelves (user_id, name) values (b, 'b の棚');
  perform t.throws('b は a の記録を自分の棚に入れられない', format($q$
      insert into public.shelf_entries
      select s.id, %L from public.shelves s where s.user_id = %L limit 1$q$, e_pub, b), 'row-level security');
  update public.profiles set bio = 'のっとり' where username = 'alice';
  get diagnostics n = row_count;
  perform t.eq('b は a のプロフィールを更新できない', n, 0);

  -- 未ログイン
  perform t.as_anon();
  perform t.eq('未ログインにも公開の記録だけ見える', (select count(*) from public.entries)::int, 1);
  perform t.eq('未ログインには公開の棚だけ見える', (select count(*) from public.shelves)::int, 1);
  perform t.eq('未ログインに非公開のコメントは出ない',
    (select count(*) from public.entries where comment = 'ひみつ')::int, 0);
  perform t.throws('未ログインは記録を作れない',
    format($q$insert into public.entries (user_id, paper_id) values (%L, %L)$q$, a, paper), 'permission denied');
  perform t.throws('未ログインは論文を足せない',
    $q$insert into public.papers (doi, title) values ('10.1/anon', 'x')$q$, 'permission denied');

  -- 公開・非公開の切り替えが、読める範囲に反映される
  perform t.as_user(a);
  update public.entries set visibility = 'private' where id = e_pub;
  perform t.as_user(b);
  perform t.eq('非公開に戻すと b から消える', (select count(*) from public.entries)::int, 0);
  perform t.eq('記録が見えなければ棚の中身も消える', (select count(*) from public.shelf_entries)::int, 0);
end;
$$;

-- ---------------------------------------------------------------
-- プロフィールと論文
-- ---------------------------------------------------------------
do $$
declare
  a constant uuid := '00000000-0000-0000-0000-00000000000a';
  b constant uuid := '00000000-0000-0000-0000-00000000000b';
begin
  perform t.as_user(a);
  perform t.throws('ユーザー名は変えられない',
    format($q$update public.profiles set username = 'alice_new' where id = %L$q$, a), 'permission denied');
  update public.profiles set bio = 'よろしく' where id = a;
  perform t.eq('自己紹介は変えられる', (select bio from public.profiles where id = a), 'よろしく');
  perform t.throws('論文の情報は書き換えられない',
    $q$update public.papers set title = '改ざん'$q$, 'permission denied');
  perform t.throws('論文は消せない', $q$delete from public.papers$q$, 'permission denied');
  perform t.throws('同じ DOI は2つ作れない',
    $q$insert into public.papers (doi, title) values ('10.1/p', '別')$q$, 'duplicate key');

  perform t.as_user(b);
  insert into public.papers (doi, title) values ('10.1/q', '論文Q');
  perform t.eq('プロフィールのある人は論文を足せる', (select count(*) from public.papers)::int, 2);
  perform t.throws('プロフィールは消せない', $q$delete from public.profiles$q$, 'permission denied');
end;
$$;

\echo 全部のテストが通りました
