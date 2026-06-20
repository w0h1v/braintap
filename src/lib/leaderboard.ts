/**
 * Daily leaderboards.
 *
 * Backed by the public `get_daily_leaderboard` / `get_live_count` Supabase RPCs.
 * Results are recorded server-side as players finish (see `lib/sync`). Until a
 * board has real entries these return empty / zero and the UI shows a
 * "coming soon" state — we never fabricate rankings or player counts. Nothing
 * here throws.
 */

import type { GameId, Difficulty } from "./types";
import { getSupabaseBrowser } from "./supabase/client";
import { todayISO } from "./daily";
import { DEFAULT_DIFFICULTY } from "./difficulty";

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  timeMs?: number;
  isYou?: boolean;
}

const DEFAULT_TOP_N = 12;

interface LeaderboardRow {
  rank: number | string;
  username: string | null;
  score: number | string;
  time_ms: number | null;
}

/**
 * Top entries for a game/date/tier from the real RPC. Returns `[]` when no board
 * exists yet (or Supabase is unconfigured) so the UI can render a coming-soon
 * state instead of placeholder rows. Never throws.
 */
export async function getDailyLeaderboard(
  gameId: GameId,
  dateISO: string = todayISO(),
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
  topN: number = DEFAULT_TOP_N,
): Promise<LeaderboardEntry[]> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("get_daily_leaderboard", {
      game: gameId,
      day: dateISO,
      diff: difficulty,
      top_n: topN,
    });
    if (!error && Array.isArray(data) && data.length > 0) {
      const myName = await currentUsername(supabase);
      return data.map((row: LeaderboardRow) => ({
        rank: Number(row.rank),
        name: row.username ?? "player",
        score: Number(row.score),
        timeMs: row.time_ms ?? undefined,
        isYou: myName != null && row.username === myName,
      }));
    }
  } catch {
    // fall through to the empty (coming-soon) state
  }
  return [];
}

/**
 * Number of players active on a date from the real RPC. Returns 0 when there's
 * no data yet (or Supabase is unconfigured). Never throws.
 */
export async function getLiveCount(dateISO: string = todayISO()): Promise<number> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.rpc("get_live_count", { day: dateISO });
    if (!error && data != null) return Number(data);
  } catch {
    // fall through to zero
  }
  return 0;
}

/** Best-effort: the signed-in user's username, for highlighting their row. */
async function currentUsername(
  supabase: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fromMeta = (meta.username as string) || undefined;
    if (fromMeta) return fromMeta;
    return user.email ? user.email.split("@")[0] : null;
  } catch {
    return null;
  }
}
