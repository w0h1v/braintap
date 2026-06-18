-- Per-difficulty leaderboards: tag each result with its tier and rank per tier.
-- Games serve Easy/Medium/Hard puzzles per day; each tier has its own board.

alter table public.game_results
  add column if not exists difficulty text not null default 'medium';

-- One result per (user, game, date, tier) instead of (user, game, date).
alter table public.game_results
  drop constraint if exists game_results_user_id_game_id_puzzle_date_key;
alter table public.game_results
  drop constraint if exists game_results_user_game_date_diff_key;
alter table public.game_results
  add constraint game_results_user_game_date_diff_key
  unique (user_id, game_id, puzzle_date, difficulty);

-- Leaderboard index now keyed by tier too.
drop index if exists idx_game_results_leaderboard;
create index if not exists idx_game_results_leaderboard
  on public.game_results (game_id, puzzle_date, difficulty, score desc, time_ms asc);

-- Replace the leaderboard RPC with a difficulty-aware version.
drop function if exists public.get_daily_leaderboard(text, date, int);
create or replace function public.get_daily_leaderboard(
  game  text,
  day   date,
  diff  text default 'medium',
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
    and gr.difficulty = diff
  order by rank
  limit greatest(top_n, 1);
$$;

revoke execute on function public.get_daily_leaderboard(text, date, text, int) from public;
grant execute on function public.get_daily_leaderboard(text, date, text, int) to anon, authenticated;
