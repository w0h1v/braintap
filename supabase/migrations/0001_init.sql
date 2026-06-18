-- BrainTap Games — initial schema
-- Supabase Auth integration: profiles + game_results, RLS, leaderboard RPCs.
-- Idempotent where reasonable so it can be re-run during local dev.

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- One row per auth user. Auto-created by the handle_new_user trigger.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text unique,
  avatar_seed    text,
  current_streak int  not null default 0,
  longest_streak int  not null default 0,
  last_played    date,
  settings       jsonb not null default '{"zen": false, "sound": true}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- game_results
-- One row per (user, game, puzzle_date). Upserted on conflict.
-- ---------------------------------------------------------------------------
create table if not exists public.game_results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  game_id     text not null,
  puzzle_date date not null,
  status      text not null default 'played',
  score       int  not null default 0,
  time_ms     int,
  moves       int,
  mistakes    int,
  stars       int,
  detail      jsonb,
  played_at   timestamptz not null default now(),
  unique (user_id, game_id, puzzle_date)
);

-- Leaderboard query support: top scores per game per day, fastest tie-break.
create index if not exists idx_game_results_leaderboard
  on public.game_results (game_id, puzzle_date, score desc, time_ms asc);

create index if not exists idx_game_results_user
  on public.game_results (user_id, puzzle_date);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- handle_new_user: auto-create a profile row when an auth user is created.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_seed)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(coalesce(new.email, 'player'), '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_seed', new.id::text)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.game_results  enable row level security;

-- profiles: a user reads/writes only their own row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

-- game_results: a user reads/writes only their own rows.
drop policy if exists "game_results_select_own" on public.game_results;
create policy "game_results_select_own"
  on public.game_results for select
  using (auth.uid() = user_id);

drop policy if exists "game_results_insert_own" on public.game_results;
create policy "game_results_insert_own"
  on public.game_results for insert
  with check (auth.uid() = user_id);

drop policy if exists "game_results_update_own" on public.game_results;
create policy "game_results_update_own"
  on public.game_results for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "game_results_delete_own" on public.game_results;
create policy "game_results_delete_own"
  on public.game_results for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Public aggregate leaderboard via SECURITY DEFINER functions.
-- These bypass RLS to expose only aggregate, non-sensitive columns
-- (rank, username, score, time_ms) to any caller.
-- ---------------------------------------------------------------------------
create or replace function public.get_daily_leaderboard(
  game text,
  day  date,
  top_n int default 25
)
returns table (
  rank     bigint,
  username text,
  score    int,
  time_ms  int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    row_number() over (
      order by gr.score desc, coalesce(gr.time_ms, 2147483647) asc, gr.played_at asc
    ) as rank,
    coalesce(p.username, 'player') as username,
    gr.score,
    gr.time_ms
  from public.game_results gr
  left join public.profiles p on p.id = gr.user_id
  where gr.game_id = game
    and gr.puzzle_date = day
  order by rank
  limit greatest(top_n, 1);
$$;

-- Number of distinct players who recorded any result on a given day.
create or replace function public.get_live_count(day date)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(distinct user_id)
  from public.game_results
  where puzzle_date = day;
$$;

-- Allow public (anon + authenticated) to call the aggregate functions.
grant execute on function public.get_daily_leaderboard(text, date, int) to anon, authenticated;
grant execute on function public.get_live_count(date) to anon, authenticated;
