-- UGC compliance (App Store Guideline 1.2).
--
-- Usernames are user-entered free text shown publicly on the leaderboards, so:
-- 1. `is_username_allowed` enforces a charset rule + profanity screen. It is
--    the server-side twin of src/lib/username.ts — KEEP THE BLOCKLISTS IN SYNC.
-- 2. A CHECK constraint applies it to every insert/update path (signup trigger,
--    REST API, future profile editing). Added NOT VALID so pre-existing rows
--    are untouched; new writes are always checked.
-- 3. `handle_new_user` now falls back to a generated name instead of failing
--    (or storing a profane name) when the requested one is invalid or taken.
-- 4. `leaderboard_reports` + `report_leaderboard_name` give players a way to
--    report an objectionable name from the leaderboard UI. The table has RLS
--    with no policies — only the SECURITY DEFINER function writes to it, and
--    only the dashboard/service role reads it.

-- ---------------------------------------------------------------------------
-- 1. Username validation
-- ---------------------------------------------------------------------------
create or replace function public.is_username_allowed(name text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    name is not null
    and length(name) between 2 and 20
    and name ~ '^[A-Za-z0-9][A-Za-z0-9._ -]*[A-Za-z0-9]$'
    and not exists (
      select 1
      from unnest(array[
        'fuck','shit','cunt','bitch','whore','slut','faggot','nigg','kike',
        'wetback','beaner','retard','rapist','pedo','hitler','nazi','porn',
        'penis','vagina','dildo','blowjob','handjob','jizz','twat','wank',
        'cocksuck','molest'
      ]) as blocked(word)
      -- normalize: lowercase, fold common leet substitutions, letters only
      where position(
        blocked.word in
        regexp_replace(translate(lower(name), '0134578@$!', 'oieastbasi'), '[^a-z]', '', 'g')
      ) > 0
    );
$$;

alter table public.profiles drop constraint if exists profiles_username_allowed_chk;
alter table public.profiles
  add constraint profiles_username_allowed_chk
  check (username is null or public.is_username_allowed(username))
  not valid;

-- ---------------------------------------------------------------------------
-- 2. handle_new_user: validate the requested name; fall back to a generated
--    one when it is disallowed or already taken (signup must not fail on it).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate   text;
  fallback    text;
  avatar_seed text;
begin
  candidate := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(coalesce(new.email, 'player'), '@', 1)
  );
  fallback := 'player_' || substr(md5(new.id::text), 1, 6);
  avatar_seed := coalesce(new.raw_user_meta_data ->> 'avatar_seed', new.id::text);

  if not public.is_username_allowed(candidate) then
    candidate := fallback;
  end if;

  begin
    insert into public.profiles (id, username, avatar_seed)
    values (new.id, candidate, avatar_seed)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username, avatar_seed)
    values (new.id, fallback, avatar_seed)
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reporting objectionable leaderboard names
-- ---------------------------------------------------------------------------
create table if not exists public.leaderboard_reports (
  id                uuid primary key default gen_random_uuid(),
  reported_username text not null,
  reason            text,
  reporter_id       uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now()
);

alter table public.leaderboard_reports enable row level security;

create or replace function public.report_leaderboard_name(
  reported text,
  reason   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if reported is null or length(trim(reported)) = 0 or length(reported) > 40 then
    raise exception 'invalid report';
  end if;
  -- Signed-in reporters only count once per name; anonymous reports are
  -- accepted as-is (the leaderboard is publicly visible).
  if auth.uid() is not null and exists (
    select 1 from public.leaderboard_reports
    where reporter_id = auth.uid() and reported_username = reported
  ) then
    return;
  end if;
  insert into public.leaderboard_reports (reported_username, reason, reporter_id)
  values (trim(reported), left(reason, 300), auth.uid());
end;
$$;

revoke execute on function public.report_leaderboard_name(text, text) from public;
grant execute on function public.report_leaderboard_name(text, text) to anon, authenticated;
