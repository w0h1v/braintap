/**
 * Brain-profile (skill) computation.
 *
 * Every game trains one or more cognitive `SkillDomain`s (see GAME_METAS). We
 * map stored results from the progress store into a 0–100 score per domain,
 * weighting recent days more heavily than old ones so the radar reflects
 * current form. Everything here is pure and works fully offline.
 */

import type { SkillDomain, GameId } from "./types";
import type { StoredResult } from "./progress";
import { GAME_METAS } from "@/games/_meta";
import { todayISO, daysBetween } from "./daily";

/** Stable order of the six domains as plotted on the radar. */
export const SKILL_DOMAINS: SkillDomain[] = [
  "memory",
  "logic",
  "verbal",
  "spatial",
  "numeric",
  "focus",
];

export interface SkillMeta {
  domain: SkillDomain;
  /** Human label, e.g. "Memory". */
  label: string;
  /** Brand accent hex for bars / radar vertices. */
  color: string;
}

/** Display metadata for each of the six skill domains. */
export const SKILL_META: Record<SkillDomain, SkillMeta> = {
  memory: { domain: "memory", label: "Memory", color: "#00e5ff" },
  logic: { domain: "logic", label: "Logic", color: "#86a3ff" },
  verbal: { domain: "verbal", label: "Verbal", color: "#ff2bd6" },
  spatial: { domain: "spatial", label: "Spatial", color: "#9b8cff" },
  numeric: { domain: "numeric", label: "Numeric", color: "#7CF5C4" },
  focus: { domain: "focus", label: "Focus", color: "#ffb020" },
};

/** Ordered list of the six skill metas (radar / bar order). */
export const SKILL_METAS: SkillMeta[] = SKILL_DOMAINS.map((d) => SKILL_META[d]);

/** The `results` map shape from the progress store: date -> gameId -> result. */
export type ResultsMap = Record<string, Partial<Record<GameId, StoredResult>>>;

/** How many days of history feed the profile. */
const WINDOW_DAYS = 30;
/** Per-day exponential decay (≈ half-life of ~10 days). */
const DAILY_DECAY = 0.93;

function zeroScores(): Record<SkillDomain, number> {
  return { memory: 0, logic: 0, verbal: 0, spatial: 0, numeric: 0, focus: 0 };
}

/**
 * Compute a 0–100 score per skill domain from stored results.
 *
 * Each result contributes its normalised `score` to every domain the game
 * trains, weighted by recency (newer days count more). The weighted average
 * per domain is the displayed value. Domains with no plays return 0.
 */
export function computeSkills(
  results: ResultsMap,
  today: string = todayISO(),
): Record<SkillDomain, number> {
  const totals = zeroScores();
  const weights = zeroScores();

  for (const [dateISO, day] of Object.entries(results)) {
    if (!day) continue;
    const age = daysBetween(dateISO, today);
    if (age < 0 || age > WINDOW_DAYS) continue;
    const recency = Math.pow(DAILY_DECAY, age);

    for (const [gameId, res] of Object.entries(day)) {
      if (!res) continue;
      const meta = GAME_METAS[gameId as GameId];
      if (!meta) continue;
      const score = clamp(res.score, 0, 100);
      for (const domain of meta.skills) {
        totals[domain] += score * recency;
        weights[domain] += recency;
      }
    }
  }

  const out = zeroScores();
  for (const domain of SKILL_DOMAINS) {
    out[domain] = weights[domain] > 0 ? Math.round(totals[domain] / weights[domain]) : 0;
  }
  return out;
}

export interface SkillHistoryPoint {
  dateISO: string;
  /** Weighted-to-date average for the domain on that day (0–100). */
  value: number;
}

/**
 * Per-skill recent history for sparkline/charts: for each of the last `days`
 * days, the running (recency-weighted) skill value as of that day. Returns a
 * dense array (oldest → newest) for every domain.
 */
export function getSkillHistory(
  results: ResultsMap,
  days: number = 14,
  today: string = todayISO(),
): Record<SkillDomain, SkillHistoryPoint[]> {
  const out = {} as Record<SkillDomain, SkillHistoryPoint[]>;
  for (const domain of SKILL_DOMAINS) out[domain] = [];

  for (let i = days - 1; i >= 0; i--) {
    const asOf = shiftISO(today, -i);
    const snapshot = computeSkills(results, asOf);
    for (const domain of SKILL_DOMAINS) {
      out[domain].push({ dateISO: asOf, value: snapshot[domain] });
    }
  }
  return out;
}

/** Mean of the six domains (0–100), the headline "brain score". */
export function overallSkill(scores: Record<SkillDomain, number>): number {
  const vals = SKILL_DOMAINS.map((d) => scores[d]);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function shiftISO(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
