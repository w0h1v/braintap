-- Hardening pass (addresses Supabase security advisor warnings on 0001).
--
-- 1. Pin a non-mutable search_path on the set_updated_at trigger function
--    (lint 0011_function_search_path_mutable).
-- 2. set_updated_at and handle_new_user are TRIGGER functions — they fire in
--    the trigger context as the table owner and are never meant to be invoked
--    directly. Postgres grants EXECUTE to PUBLIC on new functions by default,
--    which exposed them as REST RPCs (/rest/v1/rpc/...). Revoke that; the
--    triggers keep firing normally (lints 0028/0029).
--
-- NOTE: get_daily_leaderboard and get_live_count remain executable by anon +
-- authenticated ON PURPOSE — they are the public aggregate leaderboard API and
-- only expose non-sensitive aggregate columns. The advisor warnings for those
-- two are expected and accepted.

alter function public.set_updated_at() set search_path = public;

revoke execute on function public.set_updated_at()  from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
