/**
 * Daily puzzle date helpers.
 *
 * Puzzles roll over at local midnight. A "puzzle date" is an ISO date string
 * (YYYY-MM-DD). The day number (days since the BrainTap epoch) is used both to
 * index level banks and to seed procedural generators, guaranteeing that the
 * same date always produces the same puzzle.
 */

import { seedFromString } from "./rng";

/** The day BrainTap "launched" — day 1 of the archive. */
export const EPOCH_ISO = "2025-01-01";

/** Format a Date as a local YYYY-MM-DD string. */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string to a local Date at midnight. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Today's puzzle date (local). */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Whole days between two ISO dates (b - a). */
export function daysBetween(aISO: string, bISO: string): number {
  const MS = 86_400_000;
  const a = fromISODate(aISO).getTime();
  const b = fromISODate(bISO).getTime();
  return Math.round((b - a) / MS);
}

/** Day index since the epoch (epoch day = 0). */
export function dayNumber(iso: string = todayISO()): number {
  return daysBetween(EPOCH_ISO, iso);
}

/** Add days to an ISO date, returning a new ISO date. */
export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** A deterministic integer seed for a game on a given date. */
export function dailySeed(gameId: string, iso: string = todayISO()): number {
  return seedFromString(`${gameId}:${iso}`);
}

/**
 * Pick a deterministic index into a bank of `length` items for a date.
 * Uses the day number directly so consecutive days walk the bank in order
 * (with a per-game offset) rather than repeating.
 */
export function bankIndex(gameId: string, length: number, iso: string = todayISO()): number {
  if (length <= 0) return 0;
  const offset = seedFromString(gameId) % length;
  return (((dayNumber(iso) + offset) % length) + length) % length;
}

/** Milliseconds until the next local midnight (for the reset countdown). */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/** Human label like "Tuesday · June 16". */
export function dateLabel(iso: string = todayISO()): string {
  const d = fromISODate(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} · ${month} ${d.getDate()}`;
}
