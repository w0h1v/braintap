import type { ComponentType } from "react";

/** The 15 daily games. */
export type GameId =
  | "connections"
  | "brainle"
  | "strands"
  | "forge"
  | "weaver"
  | "vault"
  | "teasers"
  | "sudoku"
  | "sprint"
  | "pips"
  | "g2048"
  | "schulte"
  | "simon"
  | "slide"
  | "reversi";

/** Cognitive domains tracked on the brain profile radar. */
export type SkillDomain =
  | "verbal"
  | "logic"
  | "memory"
  | "spatial"
  | "numeric"
  | "focus";

/** A two-stop gradient + a solid fallback, expressed as hex/rgba strings. */
export interface Accent {
  from: string;
  to: string;
  solid: string;
  /** soft text/label tint used on the game's surfaces */
  soft: string;
}

export interface GameMeta {
  id: GameId;
  /** Display name, e.g. "Neural Connections". */
  name: string;
  /** One-line description shown on the hub card. */
  tagline: string;
  /** Category badge text, e.g. "VERBAL" or "LOGIC · NONOGRAM". */
  category: string;
  /** Rough completion time in minutes (for the "~4 min" label). */
  estMinutes: number;
  /** Brand accent for this game. */
  accent: Accent;
  /** Brain skills this game trains (drives the radar). */
  skills: SkillDomain[];
  /** Icon key resolved by the shared GameIcon component. */
  icon: GameId;
}

/** Outcome of a single completed (or abandoned) daily play. */
export interface GameResult {
  status: "won" | "lost" | "played";
  /** Normalised 0–100 score for cross-game comparison + leaderboards. */
  score: number;
  /** Wall-clock solve time in ms, when meaningful. */
  timeMs?: number;
  moves?: number;
  mistakes?: number;
  /** Star rating 1–3 where applicable. */
  stars?: number;
  /** Emoji grid / share string in the Wordle tradition. */
  shareText?: string;
  /** Arbitrary per-game stats (kept small; persisted as JSON). */
  detail?: Record<string, unknown>;
}

/**
 * Props passed to every game's React component.
 * @typeParam P - the puzzle shape produced by `getDailyPuzzle`.
 * @typeParam S - the resumable in-progress state shape (optional).
 */
export interface GameComponentProps<P = unknown, S = unknown> {
  /** The puzzle for the active date (deterministic). */
  puzzle: P;
  /** ISO date this puzzle belongs to. */
  dateISO: string;
  /** Called once when the player finishes. */
  onComplete: (result: GameResult) => void;
  /** Previously persisted in-progress state for resume, if any. */
  savedState?: S | null;
  /** Persist in-progress state (debounced by the host). */
  onPersistState?: (state: S) => void;
  /** Honour reduced motion / zen mode. */
  reducedMotion?: boolean;
  /** True when this is a past/archived puzzle (read-only-ish, no streak). */
  isArchive?: boolean;
}

/**
 * A self-contained game module. Each game lives in `src/games/<id>/` and the
 * default export of its `index.ts` is one of these.
 */
export interface GameModule<P = unknown, S = unknown> {
  meta: GameMeta;
  /** Deterministically produce the puzzle for a given ISO date. */
  getDailyPuzzle: (dateISO: string) => P;
  /** The playable React component. */
  Component: ComponentType<GameComponentProps<P, S>>;
  /**
   * Validate that a puzzle is well-formed and solvable. Used by the test
   * suite to guarantee every daily/banked puzzle can be completed.
   * Return true if valid; throw or return false otherwise.
   */
  validatePuzzle?: (puzzle: P) => boolean;
}

/**
 * Loosely-typed module for the registry. Component prop types are invariant,
 * so the registry stores modules as `any`-parameterised while each game keeps
 * its own precise types internally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameModule = GameModule<any, any>;

/** Helper for game authors to get full typing on their module. */
export function defineGame<P, S>(mod: GameModule<P, S>): GameModule<P, S> {
  return mod;
}
