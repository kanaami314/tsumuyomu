-- ローカルの素の PostgreSQL でテストするための、Supabase の代用品。
-- 本物の Supabase には、これと同じものが最初からある。マイグレーションには含めない。

create role anon nologin;
create role authenticated nologin;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (id uuid primary key);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;

-- Supabase の既定: public スキーマの表と関数は、anon と authenticated に開いている(守るのは RLS と revoke)
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
