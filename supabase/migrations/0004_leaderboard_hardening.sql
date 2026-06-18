-- Leaderboard hardening (from the code audit).
-- 1. Constrain difficulty to the known tiers (defends against arbitrary client
--    writes via the authenticated REST API).
-- 2. Cap the leaderboard RPC page size so the SECURITY DEFINER function can't be
--    coerced into returning an unbounded result by a caller-supplied top_n.

alter table public.game_results drop constraint if exists game_results_difficulty_chk;
alter table public.game_results
  add constraint game_results_difficulty_chk check (difficulty in ('easy','medium','hard'));

create or replace function public.get_daily_leaderboard(
  game  text,
  day   date,
  diff  text default 'medium',
  top_n int default 25
)
returns table (rank bigint, username text, score int, time_ms int)
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
  limit least(greatest(top_n, 1), 100);
$$;

revoke execute on function public.get_daily_leaderboard(text, date, text, int) from public;
grant execute on function public.get_daily_leaderboard(text, date, text, int) to anon, authenticated;
