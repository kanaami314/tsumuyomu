-- 招待コードの利用の記録(M6)。どのコードで、誰が登録したかを、運営だけが見られるようにする。
-- profiles は誰でも読めるので、そこには入れず、別の表にする。画面(anon / authenticated)からは、読めも書けもしない。

create table public.invite_uses (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null references public.invite_codes (code) on delete cascade,
  used_at timestamptz not null default now()
);

alter table public.invite_uses enable row level security;
revoke all on public.invite_uses from anon, authenticated;

-- claim_invite に、利用の記録を足す(ほかは、最初の定義と同じ)
create or replace function public.claim_invite(p_code text, p_username text)
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
  insert into public.invite_uses (user_id, code) values (uid, code_row.code);

  return result;
end;
$$;

revoke execute on function public.claim_invite(text, text) from public, anon;
grant execute on function public.claim_invite(text, text) to authenticated;
