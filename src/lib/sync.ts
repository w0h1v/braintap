/**
 * Two-way sync between the local zustand progress store and Supabase.
 *
 * When a user is logged in we push local game_results (upsert), pull remote
 * results and merge them into the store, and upsert the profile streak.
 * Everything is guarded; offline (no Supabase / no session) this is a no-op.
 */

import { getSupabaseBrowser } from "./supabase/client";
import { useProgress, type StoredResult } from "./progress";
import type { GameId, GameResult } from "./types";
import { isGameId } from "./games";

interface RemoteResultRow {
  game_id: string;
  puzzle_date: string;
  status: string;
  score: number;
  time_ms: number | null;
  moves: number | null;
  mistakes: number | null;
  stars: number | null;
  detail: Record<string, unknown> | null;
  played_at: string;
}

/** Flatten the store's nested results map into a list. */
function flattenLocal(): StoredResult[] {
  const { results } = useProgress.getState();
  const out: StoredResult[] = [];
  for (const day of Object.values(results)) {
    if (!day) continue;
    for (const res of Object.values(day)) {
      if (res) out.push(res);
    }
  }
  return out;
}

function toRemoteRow(userId: string, r: StoredResult) {
  return {
    user_id: userId,
    game_id: r.gameId,
    puzzle_date: r.dateISO,
    status: r.status,
    score: r.score,
    time_ms: r.timeMs ?? null,
    moves: r.moves ?? null,
    mistakes: r.mistakes ?? null,
    stars: r.stars ?? null,
    detail: (r.detail as Record<string, unknown>) ?? null,
    played_at: new Date(r.playedAt).toISOString(),
  };
}

function rowToResult(row: RemoteResultRow): StoredResult | null {
  if (!isGameId(row.game_id)) return null;
  const base: GameResult = {
    status: (row.status as GameResult["status"]) ?? "played",
    score: row.score ?? 0,
    timeMs: row.time_ms ?? undefined,
    moves: row.moves ?? undefined,
    mistakes: row.mistakes ?? undefined,
    stars: row.stars ?? undefined,
    detail: row.detail ?? undefined,
  };
  return {
    ...base,
    gameId: row.game_id as GameId,
    dateISO: row.puzzle_date,
    playedAt: Date.parse(row.played_at) || Date.now(),
  };
}

/** Merge a remote result into the store, keeping the higher score. */
function mergeRemote(rows: RemoteResultRow[]) {
  const state = useProgress.getState();
  const next = { ...state.results };
  let changed = false;

  for (const row of rows) {
    const result = rowToResult(row);
    if (!result) continue;
    const day = { ...(next[result.dateISO] ?? {}) };
    const existing = day[result.gameId];
    if (!existing || result.score > existing.score) {
      day[result.gameId] = result;
      next[result.dateISO] = day;
      changed = true;
    }
  }

  if (changed) useProgress.setState({ results: next });
}

/**
 * Push local results, pull + merge remote results, and upsert the profile
 * streak. No-op when Supabase is not configured or no user is signed in.
 * Never throws.
 */
export async function syncProgress(): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user) return;
    const userId = session.user.id;

    // 1. Push local results (upsert on (user_id, game_id, puzzle_date)).
    const local = flattenLocal();
    if (local.length > 0) {
      const rows = local.map((r) => toRemoteRow(userId, r));
      await supabase
        .from("game_results")
        .upsert(rows, { onConflict: "user_id,game_id,puzzle_date" });
    }

    // 2. Pull remote results and merge.
    const { data: remote, error: pullErr } = await supabase
      .from("game_results")
      .select("game_id,puzzle_date,status,score,time_ms,moves,mistakes,stars,detail,played_at")
      .eq("user_id", userId);
    if (!pullErr && Array.isArray(remote)) {
      mergeRemote(remote as RemoteResultRow[]);
    }

    // 3. Upsert the profile streak.
    const { currentStreak, longestStreak, lastPlayedISO } = useProgress.getState();
    await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          current_streak: currentStreak,
          longest_streak: longestStreak,
          last_played: lastPlayedISO,
        },
        { onConflict: "id" },
      );
  } catch {
    // Offline / transient failure — local store remains the source of truth.
  }
}
