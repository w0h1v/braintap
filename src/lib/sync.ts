/**
 * Two-way sync between the local zustand progress store and Supabase.
 *
 * When a user is logged in we push local results (per difficulty tier), pull
 * remote results and merge them into the store, and upsert the profile streak.
 * Everything is guarded; offline (no Supabase / no session) this is a no-op.
 */

import { getSupabaseBrowser } from "./supabase/client";
import { useProgress, type StoredResult } from "./progress";
import type { GameId, GameResult, Difficulty } from "./types";
import { isGameId } from "./games";

interface RemoteResultRow {
  game_id: string;
  puzzle_date: string;
  difficulty: string | null;
  status: string;
  score: number;
  time_ms: number | null;
  moves: number | null;
  mistakes: number | null;
  stars: number | null;
  detail: Record<string, unknown> | null;
  played_at: string;
}

function asDifficulty(v: unknown): Difficulty {
  return v === "easy" || v === "hard" ? v : "medium";
}

/**
 * Flatten the store into the set of rows to upload — one per (game, date,
 * tier). Per-tier results carry their own difficulty; representative results
 * for games without tier rows (legacy single-puzzle games) upload as "medium".
 */
function flattenForUpload(): StoredResult[] {
  const { results, tierResults } = useProgress.getState();
  const out: StoredResult[] = [];

  for (const [, games] of Object.entries(tierResults)) {
    if (!games) continue;
    for (const tiers of Object.values(games)) {
      if (!tiers) continue;
      for (const res of Object.values(tiers)) {
        if (res) out.push(res);
      }
    }
  }

  for (const [date, games] of Object.entries(results)) {
    if (!games) continue;
    for (const [game, res] of Object.entries(games)) {
      if (!res) continue;
      // Skip games that already contributed per-tier rows above.
      if (tierResults[date]?.[game as GameId]) continue;
      out.push({ ...res, difficulty: res.difficulty ?? "medium" });
    }
  }

  return out;
}

function toRemoteRow(userId: string, r: StoredResult) {
  return {
    user_id: userId,
    game_id: r.gameId,
    puzzle_date: r.dateISO,
    difficulty: r.difficulty ?? "medium",
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
    difficulty: asDifficulty(row.difficulty),
    playedAt: Date.parse(row.played_at) || Date.now(),
  };
}

/** Merge remote rows into both the per-tier map and the representative map. */
function mergeRemote(rows: RemoteResultRow[]) {
  const state = useProgress.getState();
  const results = { ...state.results };
  const tierResults = { ...state.tierResults };
  let changed = false;

  for (const row of rows) {
    const result = rowToResult(row);
    if (!result) continue;
    const diff = result.difficulty ?? "medium";

    // Per-tier (keep higher score).
    const dayT = { ...(tierResults[result.dateISO] ?? {}) };
    const gameT = { ...(dayT[result.gameId] ?? {}) };
    if (!gameT[diff] || result.score > (gameT[diff]?.score ?? -1)) {
      gameT[diff] = result;
      dayT[result.gameId] = gameT;
      tierResults[result.dateISO] = dayT;
      changed = true;
    }

    // Representative (best across tiers).
    const dayR = { ...(results[result.dateISO] ?? {}) };
    if (!dayR[result.gameId] || result.score > (dayR[result.gameId]?.score ?? -1)) {
      dayR[result.gameId] = result;
      results[result.dateISO] = dayR;
      changed = true;
    }
  }

  if (changed) useProgress.setState({ results, tierResults });
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

    // 1. Push local results (upsert on (user_id, game_id, puzzle_date, difficulty)).
    const local = flattenForUpload();
    if (local.length > 0) {
      const rows = local.map((r) => toRemoteRow(userId, r));
      await supabase
        .from("game_results")
        .upsert(rows, { onConflict: "user_id,game_id,puzzle_date,difficulty" });
    }

    // 2. Pull remote results and merge.
    const { data: remote, error: pullErr } = await supabase
      .from("game_results")
      .select(
        "game_id,puzzle_date,difficulty,status,score,time_ms,moves,mistakes,stars,detail,played_at",
      )
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
