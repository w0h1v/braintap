/**
 * Daily leaderboards.
 *
 * When Supabase is configured we call the public `get_daily_leaderboard` /
 * `get_live_count` RPCs. Otherwise we synthesize a deterministic, plausible
 * leaderboard seeded by `gameId + date`, splicing in the local player's own
 * result if they've played today. Nothing here ever throws.
 */

import type { GameId, Difficulty } from "./types";
import { getSupabaseBrowser } from "./supabase/client";
import { rngFromString, type Rng } from "./rng";
import { dayNumber, todayISO } from "./daily";
import { DEFAULT_DIFFICULTY } from "./difficulty";
import { useProgress } from "./progress";

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  timeMs?: number;
  isYou?: boolean;
}

/** Pool of plausible handles for synthesized boards. */
const FAKE_NAMES = [
  "quanta_owl", "sera.codes", "mind_drift", "nori", "axon_ace", "delta.wave",
  "lumen", "pixel_monk", "echo_finch", "thalamus", "rune_kit", "vellum",
  "cobalt_fox", "synapse9", "kestrel", "mneme", "orbit.lab", "ferran",
  "ivy_logic", "zephyr", "cortex_cat", "halcyon", "moss_rook", "drift_io",
  "ada_glint", "noir_pi", "sable", "wren.dev", "quasar", "lattice",
];

const DEFAULT_TOP_N = 12;

/** Build a deterministic synthetic board for a game/date. */
function synthBoard(
  gameId: string,
  dateISO: string,
  topN: number,
  you?: { score: number; timeMs?: number },
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
): LeaderboardEntry[] {
  const rng = rngFromString(`lb:${gameId}:${difficulty}:${dateISO}`);
  const names = rng.shuffle(FAKE_NAMES).slice(0, topN + 4);

  // Generate descending plausible scores in the 55–99 range.
  let score = rng.int(92, 99);
  const rows: { name: string; score: number; timeMs: number }[] = [];
  for (const name of names) {
    rows.push({
      name,
      score,
      timeMs: rng.int(35_000, 280_000),
    });
    score = Math.max(40, score - rng.int(1, 6));
  }

  // Splice the local player in by their real score, if present.
  if (you) {
    rows.push({ name: "You", score: clamp(you.score, 0, 100), timeMs: you.timeMs ?? rng.int(60_000, 200_000) });
  }

  rows.sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);

  return rows.slice(0, topN).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    timeMs: r.timeMs,
    isYou: r.name === "You",
  }));
}

/** The local player's result for a game/date/tier, if any (browser only). */
function localResult(
  gameId: GameId,
  dateISO: string,
  difficulty: Difficulty,
): { score: number; timeMs?: number } | undefined {
  try {
    const st = useProgress.getState();
    const res =
      st.tierResults[dateISO]?.[gameId]?.[difficulty] ?? st.results[dateISO]?.[gameId];
    if (!res) return undefined;
    return { score: res.score, timeMs: res.timeMs };
  } catch {
    return undefined;
  }
}

/**
 * Top entries for a game on a date. Real via RPC when configured, otherwise a
 * deterministic synthesized board. Never throws.
 */
export async function getDailyLeaderboard(
  gameId: GameId,
  dateISO: string = todayISO(),
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
  topN: number = DEFAULT_TOP_N,
): Promise<LeaderboardEntry[]> {
  const you = localResult(gameId, dateISO, difficulty);
  const supabase = getSupabaseBrowser();

  if (supabase) {
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
      // fall through to synth
    }
  }

  return synthBoard(gameId, dateISO, topN, you);
}

/**
 * Number of players active on a date. Real via RPC when configured, otherwise
 * a deterministic synthesized count. Never throws.
 */
export async function getLiveCount(dateISO: string = todayISO()): Promise<number> {
  const supabase = getSupabaseBrowser();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("get_live_count", { day: dateISO });
      if (!error && data != null) return Number(data);
    } catch {
      // fall through to synth
    }
  }
  return synthLiveCount(dateISO);
}

/** Deterministic "minds tapped in today" count that drifts day to day. */
function synthLiveCount(dateISO: string): number {
  const rng: Rng = rngFromString(`live:${dateISO}`);
  const base = 38_000 + (dayNumber(dateISO) % 30) * 420;
  return base + rng.int(0, 14_000);
}

interface LeaderboardRow {
  rank: number | string;
  username: string | null;
  score: number | string;
  time_ms: number | null;
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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
