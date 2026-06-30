"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { useFitBox } from "@/lib/useFitBox";
import { cn } from "@/lib/cn";
import {
  SIZE,
  CELLS,
  WIN_TILE,
  applySpawn,
  canMove,
  hasWon,
  maxTile,
  moveWithPaths,
  targetOf,
  type Direction,
  type G2048Puzzle,
} from "./engine";

const ACCENT = GAME_METAS.g2048.accent;
const INSIGHT = GAME_METAS.g2048.insight;

/** Animation timing (ms). Slide first, then the spawn/merge accents land. */
const SLIDE_MS = 120;
const POP_MS = 200;

/** [background, text] per tile value; anything higher falls back to the magenta cap. */
const COLOR_FOR: Record<number, [string, string]> = {
  2: ["#2a3358", "#cdd8f0"],
  4: ["#33406e", "#dfe9ff"],
  8: ["#3a5bd9", "#eafcff"],
  16: ["#5b8cff", "#04060f"],
  32: ["#00a8c8", "#04060f"],
  64: ["#00e5ff", "#04060f"],
  128: ["#7CF5C4", "#04140d"],
  256: ["#16b97e", "#eafcff"],
  512: ["#ff9e3d", "#04060f"],
  1024: ["#ff6b9d", "#04060f"],
  2048: ["#ff2bd6", "#ffffff"],
};
const colorFor = (v: number): [string, string] => COLOR_FOR[v] ?? ["#ff2bd6", "#ffffff"];

/** A subtle outer glow for the higher-value tiles, so milestones read as "hot". */
function tileGlow(v: number): string {
  if (v >= WIN_TILE) return "0 0 22px rgba(255,43,214,0.55), 0 2px 12px rgba(0,0,0,0.3)";
  if (v >= 256) {
    const [bg] = colorFor(v);
    return `0 0 16px ${bg}66, 0 2px 10px rgba(0,0,0,0.28)`;
  }
  return "0 2px 10px rgba(0,0,0,0.25)";
}

/**
 * A redundant, non-color cue for tile tier so value isn't conveyed by colour
 * alone: milestone tiles gain a progressively stronger inset ring. The number
 * itself remains the primary cue.
 */
function tileRing(v: number): string | undefined {
  if (v >= WIN_TILE) return "inset 0 0 0 2.5px rgba(255,255,255,0.9)";
  if (v >= 512) return "inset 0 0 0 2px rgba(255,255,255,0.6)";
  if (v >= 128) return "inset 0 0 0 1.5px rgba(255,255,255,0.35)";
  return undefined;
}

function tileFontSize(v: number): string {
  if (v >= 1024) return "clamp(15px, 5vw, 22px)";
  if (v >= 128) return "clamp(18px, 6vw, 26px)";
  return "clamp(22px, 7.2vw, 30px)";
}

interface G2048State {
  grid: number[];
  score: number;
  best: number;
  spawnIndex: number;
  won: boolean;
  over: boolean;
  /** Player chose to keep playing after reaching the target. */
  continued: boolean;
  /** Set once onComplete has fired, so it only fires a single time. */
  completed: boolean;
  /**
   * Accumulated play time (ms) for the run, persisted so a resumed game keeps a
   * meaningful clock. Optional for backward-compatibility with older saves.
   */
  elapsedMs?: number;
}

/**
 * A rendered tile with a stable identity so React (and CSS transforms) can
 * animate it from one cell to the next across moves. `cell` is the board index
 * (0..15). `spawn`/`pop` are transient accent flags consumed after one frame.
 */
interface RTile {
  id: number;
  value: number;
  cell: number;
  /** Freshly spawned this move — fade/scale in after the slide. */
  spawn?: boolean;
  /** Result of a merge this move — gets a scale "pop". */
  pop?: boolean;
}

/** State captured immediately before a move, for single-step undo. */
interface G2048Snapshot {
  grid: number[];
  score: number;
  best: number;
  spawnIndex: number;
  won: boolean;
  over: boolean;
  continued: boolean;
  moves: number;
}

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: "U",
  ArrowDown: "D",
  ArrowLeft: "L",
  ArrowRight: "R",
  w: "U",
  W: "U",
  s: "D",
  S: "D",
  a: "L",
  A: "L",
  d: "R",
  D: "R",
};

/** Build the initial rendered-tile list from a flat grid (no animation flags). */
function tilesFromGrid(grid: number[], startId: number): { tiles: RTile[]; nextId: number } {
  const tiles: RTile[] = [];
  let id = startId;
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) tiles.push({ id: id++, value: grid[i], cell: i });
  }
  return { tiles, nextId: id };
}

export function G2048({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion = false,
  // hostTimer is honoured below: when true the host shows a unified timer, so
  // this component never renders its own visible clock (it has none), while all
  // internal timing logic is kept so result.timeMs is still reported.
  hostTimer = false,
}: GameComponentProps<G2048Puzzle, G2048State>) {
  const saved = savedState ?? null;

  // The win target is driven by the difficulty tier the host selects, via the
  // puzzle it passes (legacy puzzles fall back to the medium 512 target).
  const target = targetOf(puzzle);

  const [grid, setGrid] = useState<number[]>(() => saved?.grid ?? puzzle.start.slice());
  // Logical board for accessibility: updated SYNCHRONOUSLY the instant a move
  // resolves, before the slide animation commits the visual `grid` (SLIDE_MS
  // later). The gridcell aria-labels read from this so screen readers always
  // describe the true post-move board, never the stale committed grid.
  const [labelGrid, setLabelGrid] = useState<number[]>(() => saved?.grid ?? puzzle.start.slice());
  const [score, setScore] = useState(() => saved?.score ?? 0);
  const [best, setBest] = useState(() => saved?.best ?? 0);
  const [spawnIndex, setSpawnIndex] = useState(() => saved?.spawnIndex ?? 0);
  const [won, setWon] = useState(() => saved?.won ?? false);
  const [over, setOver] = useState(() => saved?.over ?? false);
  const [continued, setContinued] = useState(() => saved?.continued ?? false);
  const [showModal, setShowModal] = useState(false);
  /** Last points gained, surfaced as a floating "+N" near the score. */
  const [gainPulse, setGainPulse] = useState<{ id: number; amount: number } | null>(null);
  /** Direction nudge for tactile feedback when a move is rejected. */
  const [nudge, setNudge] = useState<Direction | null>(null);

  // Stable-identity tiles for animation. Seeded from the (possibly restored) grid.
  const idRef = useRef(0);
  const [tiles, setTiles] = useState<RTile[]>(() => {
    const init = tilesFromGrid(saved?.grid ?? puzzle.start.slice(), 0);
    idRef.current = init.nextId;
    return init.tiles;
  });

  const completedRef = useRef(saved?.completed ?? false);
  const movesRef = useRef(0);
  // Single-step undo: holds the committed state just before the most recent move.
  const undoRef = useRef<G2048Snapshot | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);

  // --- Timing -----------------------------------------------------------------
  // Wall-clock play time for the run, so result.timeMs is reported. The host
  // owns the *visible* timer (hostTimer); this component keeps the logic only.
  // We accumulate elapsed ms: a session that resumes a save continues from the
  // persisted total. The clock advances only while the game is still playable.
  const baseElapsedRef = useRef<number>(
    typeof saved?.elapsedMs === "number" && saved.elapsedMs >= 0 ? saved.elapsedMs : 0,
  );
  // Timestamp (Date.now) the current run segment started; null when paused/over.
  const segStartRef = useRef<number | null>(null);
  // The frozen final time (ms) captured the moment the run ends.
  const finalMsRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(baseElapsedRef.current);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Total elapsed = persisted base + the live current segment. */
  const computeElapsed = useCallback(() => {
    const seg = segStartRef.current != null ? Date.now() - segStartRef.current : 0;
    return baseElapsedRef.current + seg;
  }, []);

  /** Fold the live segment into the base (used on pause/finish/persist). */
  const settleElapsed = useCallback(() => {
    if (segStartRef.current != null) {
      baseElapsedRef.current += Date.now() - segStartRef.current;
      segStartRef.current = null;
    }
    setElapsedMs(baseElapsedRef.current);
    return baseElapsedRef.current;
  }, []);

  const gainIdRef = useRef(0);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Pending post-slide timers (spawn-in, merge cleanup) — cleared on unmount. */
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /**
   * True while a slide/merge animation is mid-flight. The board grid only
   * updates once the slide finishes, so accepting another move before then
   * would re-derive paths from the stale grid and desync the tile layer. We
   * drop input during this short window (animated mode only).
   */
  const animatingRef = useRef(false);

  // The game is locked only when it is over, or won AND the player has not opted
  // to keep playing past the target (the spec allows continuing for a higher
  // score).
  const locked = over || (won && !continued);

  // Run the play clock while the game is live (not over, not finished). When the
  // run ends, finalMsRef holds the frozen time. A "Keep playing" un-locks and
  // the clock resumes (the persisted total carries the earlier segment).
  useEffect(() => {
    const live = !over && !(won && !continued) && finalMsRef.current == null;
    if (live) {
      if (segStartRef.current == null) segStartRef.current = Date.now();
      if (!tickRef.current) {
        tickRef.current = setInterval(() => setElapsedMs(computeElapsed()), 250);
      }
    } else {
      // Pause: fold the live segment into the base and stop ticking.
      settleElapsed();
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [over, won, continued, computeElapsed, settleElapsed]);

  // Persist resumable state (JSON-serialisable only).
  useEffect(() => {
    onPersistState?.({
      grid,
      score,
      best,
      spawnIndex,
      won,
      over,
      continued,
      completed: completedRef.current,
      elapsedMs: computeElapsed(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, score, best, spawnIndex, won, over, continued]);

  // Once the run locks (game over, or won-and-not-continued), discard the undo
  // bank so the disabled Undo button is honest: the terminal move cannot be
  // taken back. "Keep playing" un-locks for a fresh sequence of undoable moves.
  useEffect(() => {
    if (locked) {
      undoRef.current = null;
      setUndoAvailable(false);
    }
  }, [locked]);

  // Clear any pending timers on unmount.
  useEffect(() => {
    return () => {
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
      if (tickRef.current) clearInterval(tickRef.current);
      for (const t of animTimers.current) clearTimeout(t);
    };
  }, []);

  // React to a difficulty switch from the host: the puzzle (start board + win
  // target) changes, so reset the in-progress game to the new tier's opening.
  // The host hands us the tier's own savedState, but if a fresh tier has no
  // save we still need to clear the previous tier's live board. We key off the
  // puzzle's start signature + target so identical puzzles don't reset.
  const puzzleSig = `${target}:${puzzle.start.join(",")}`;
  const lastPuzzleSigRef = useRef(puzzleSig);
  useEffect(() => {
    if (lastPuzzleSigRef.current === puzzleSig) return;
    lastPuzzleSigRef.current = puzzleSig;
    // Adopt the new tier's saved progress if present, else its fresh opening.
    const nextGrid = saved?.grid ?? puzzle.start.slice();
    for (const t of animTimers.current) clearTimeout(t);
    animTimers.current = [];
    animatingRef.current = false;
    finalMsRef.current = null;
    segStartRef.current = null;
    baseElapsedRef.current =
      typeof saved?.elapsedMs === "number" && saved.elapsedMs >= 0 ? saved.elapsedMs : 0;
    completedRef.current = saved?.completed ?? false;
    movesRef.current = 0;
    setGrid(nextGrid);
    setLabelGrid(nextGrid);
    setScore(saved?.score ?? 0);
    setBest(saved?.best ?? 0);
    setSpawnIndex(saved?.spawnIndex ?? 0);
    setWon(saved?.won ?? false);
    setOver(saved?.over ?? false);
    setContinued(saved?.continued ?? false);
    setShowModal(false);
    setElapsedMs(baseElapsedRef.current);
    const rebuilt = tilesFromGrid(nextGrid, idRef.current);
    idRef.current = rebuilt.nextId;
    setTiles(rebuilt.tiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleSig]);

  const fireComplete = useCallback(
    (finalGrid: number[], finalScore: number, didWin: boolean) => {
      // Freeze the play time at the moment the run ends. (Always do this so a
      // replayed run reports a correct clock even if the daily was recorded.)
      const timeMs = settleElapsed();
      finalMsRef.current = timeMs;

      // Always surface the result UI (modal + confetti) on every win/loss, even
      // on a replay after the daily has been recorded. The one-time recording of
      // the daily result is gated separately on completedRef below.
      if (!reducedMotion) setTimeout(() => setShowModal(true), 300);
      else setShowModal(true);

      // Record the daily result exactly once.
      if (completedRef.current) return;
      completedRef.current = true;
      const top = maxTile(finalGrid);
      // Normalised 0–100: reaching the tier target is a 100; otherwise scale by
      // the largest tile reached relative to the target (each doubling is one
      // step toward the target).
      const logTop = Math.log2(Math.max(2, top));
      const logTarget = Math.log2(target);
      const score100 = didWin
        ? 100
        : Math.max(5, Math.min(95, Math.round((logTop / logTarget) * 100)));
      const shareText = `BrainTap · 2048\n${
        didWin ? `Reached ${target}! 🟪` : `Best tile ${top} · Score ${finalScore}`
      }\n\nbraintap.app/games`;
      onComplete({
        status: didWin ? "won" : "lost",
        score: score100,
        timeMs,
        moves: movesRef.current,
        shareText,
        detail: { score: finalScore, bestTile: top, won: didWin, target },
      });
    },
    [onComplete, reducedMotion, settleElapsed, target],
  );

  const doMove = useCallback(
    (dir: Direction) => {
      // `locked` already covers game-over and the won-but-not-continued state.
      // We deliberately do NOT bail on completedRef here: after "Keep playing"
      // the result has already fired once, but play must continue. Re-firing is
      // prevented inside fireComplete itself.
      if (locked) return;
      // Ignore input while a slide is animating (the grid hasn't committed yet).
      if (animatingRef.current) return;
      const res = moveWithPaths(grid, dir);
      if (!res.moved) {
        // Invalid move: no spawn, no score — but give a small tactile nudge so the
        // input doesn't feel dead. Honour reducedMotion.
        sfx.tap();
        haptics.tap();
        if (!reducedMotion) {
          if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
          setNudge(dir);
          nudgeTimer.current = setTimeout(() => setNudge(null), 160);
        }
        return;
      }

      // Bank the pre-move state so this single move can be undone.
      undoRef.current = {
        grid: grid.slice(),
        score,
        best,
        spawnIndex,
        won,
        over,
        continued,
        moves: movesRef.current,
      };
      setUndoAvailable(true);

      movesRef.current += 1;

      // Spawn the next scripted tile into an empty cell.
      const spawn = puzzle.spawns[spawnIndex % puzzle.spawns.length];
      const before = res.grid;
      const after = applySpawn(before, spawn);
      const spawnedCell = after.findIndex((v, i) => before[i] === 0 && v !== 0);

      const nextScore = score + res.gained;
      const nextBest = Math.max(best, nextScore);

      // Commit the logical board for accessibility immediately, regardless of
      // the animation phase, so aria-labels never lag behind the real state.
      setLabelGrid(after);

      setScore(nextScore);
      setBest(nextBest);
      setSpawnIndex((s) => s + 1);

      if (res.gained > 0) {
        sfx.place();
        haptics.success();
        gainIdRef.current += 1;
        setGainPulse({ id: gainIdRef.current, amount: res.gained });
      } else {
        sfx.tap();
        haptics.tap();
      }

      // ---- Tile animation -------------------------------------------------
      // Map each currently-rendered tile (keyed by its source cell) onto its
      // path. Surviving tiles keep their id and slide to `to`; merge partners
      // also slide to the merge destination, then we collapse to one popped
      // tile after the slide finishes. The spawned tile appears post-slide.
      const byCell = new Map<number, RTile>();
      for (const t of tiles) byCell.set(t.cell, t);

      if (reducedMotion) {
        // Instant: rebuild the tile list straight from the final grid.
        for (const t of animTimers.current) clearTimeout(t);
        animTimers.current = [];
        const rebuilt = tilesFromGrid(after, idRef.current);
        idRef.current = rebuilt.nextId;
        setTiles(rebuilt.tiles);
        setGrid(after);
      } else {
        animatingRef.current = true;
        // Phase 1: slide everyone (including merge partners) to their targets.
        // Both tiles of a merge briefly occupy the destination cell.
        const sliding: RTile[] = [];
        for (const p of res.paths) {
          const primary = byCell.get(p.from);
          if (primary) sliding.push({ ...primary, cell: p.to, spawn: false, pop: false });
          if (p.merged && p.mergedFrom !== undefined) {
            const partner = byCell.get(p.mergedFrom);
            if (partner) sliding.push({ ...partner, cell: p.to, spawn: false, pop: false });
          }
        }
        setTiles(sliding);

        // Phase 2 (after the slide): collapse merges to the new value with a pop,
        // and fade/scale in the freshly spawned tile.
        const t1 = setTimeout(() => {
          const collapsed: RTile[] = [];
          // Keep one tile per destination cell, taking the post-merge value.
          const claimed = new Set<number>();
          for (const p of res.paths) {
            if (claimed.has(p.to)) continue;
            claimed.add(p.to);
            const primary = byCell.get(p.from);
            const id = primary ? primary.id : idRef.current++;
            collapsed.push({ id, value: p.value, cell: p.to, pop: p.merged });
          }
          if (spawnedCell >= 0) {
            collapsed.push({ id: idRef.current++, value: after[spawnedCell], cell: spawnedCell, spawn: true });
          }
          setTiles(collapsed);
          setGrid(after);
          // Grid is now committed; the next move can derive paths from it.
          animatingRef.current = false;

          // Phase 3: clear transient accent flags so future moves animate cleanly.
          const t2 = setTimeout(() => {
            setTiles((cur) => cur.map((t) => (t.spawn || t.pop ? { ...t, spawn: false, pop: false } : t)));
          }, POP_MS);
          animTimers.current.push(t2);
        }, SLIDE_MS);
        animTimers.current.push(t1);
      }

      const didWin = !won && hasWon(after, target);
      if (didWin) {
        setWon(true);
        haptics.win();
        sfx.win();
        fireComplete(after, nextScore, true);
        return;
      }

      if (!canMove(after)) {
        setOver(true);
        haptics.error();
        sfx.wrong();
        fireComplete(after, nextScore, false);
      }
    },
    [grid, tiles, locked, puzzle.spawns, spawnIndex, score, best, won, over, continued, reducedMotion, fireComplete, target],
  );

  // Single-step undo — revert the last committed move. Available during active
  // play only (not once the run is won/over) and only when a move is banked.
  const undo = useCallback(() => {
    const snap = undoRef.current;
    if (!snap || locked || animatingRef.current) return;
    for (const t of animTimers.current) clearTimeout(t);
    animTimers.current = [];
    animatingRef.current = false;
    setGrid(snap.grid.slice());
    setLabelGrid(snap.grid.slice());
    setScore(snap.score);
    setBest(snap.best);
    setSpawnIndex(snap.spawnIndex);
    setWon(snap.won);
    setOver(snap.over);
    setContinued(snap.continued);
    movesRef.current = snap.moves;
    const rebuilt = tilesFromGrid(snap.grid, idRef.current);
    idRef.current = rebuilt.nextId;
    setTiles(rebuilt.tiles);
    undoRef.current = null;
    setUndoAvailable(false);
    setNudge(null);
    sfx.tap();
    haptics.tap();
  }, [locked]);

  // Restart the current puzzle from its scripted opening. Resets the board,
  // score and clock and re-arms the live timer. The daily lock is untouched: a
  // replay after the result is recorded stays practice and never re-records.
  const restart = useCallback(() => {
    for (const t of animTimers.current) clearTimeout(t);
    animTimers.current = [];
    animatingRef.current = false;
    const fresh = puzzle.start.slice();
    // Reset the play clock for a fresh attempt and re-arm the live segment.
    baseElapsedRef.current = 0;
    segStartRef.current = null;
    finalMsRef.current = null;
    setElapsedMs(0);
    movesRef.current = 0;
    undoRef.current = null;
    setUndoAvailable(false);
    setGrid(fresh);
    setLabelGrid(fresh);
    setScore(0);
    setSpawnIndex(0);
    setWon(false);
    setOver(false);
    setContinued(false);
    setShowModal(false);
    setNudge(null);
    const rebuilt = tilesFromGrid(fresh, idRef.current);
    idRef.current = rebuilt.nextId;
    setTiles(rebuilt.tiles);
    sfx.tap();
    haptics.tap();
  }, [puzzle.start]);

  // Keyboard: arrows + WASD.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        restart();
        return;
      }
      const dir = KEY_TO_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      doMove(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doMove, undo, restart]);

  // Swipe input on the board.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const MIN = 24;
      if (Math.abs(dx) < MIN && Math.abs(dy) < MIN) return;
      if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "R" : "L");
      else doMove(dy > 0 ? "D" : "U");
    },
    [doMove],
  );

  const keepPlaying = useCallback(() => {
    setContinued(true);
    setShowModal(false);
  }, []);

  // Largest tile, from the logical board so it tracks moves synchronously.
  const finalTop = useMemo(() => maxTile(labelGrid), [labelGrid]);

  // Next power-of-two milestone above the current best tile — used to give
  // "Keep playing" a concrete, named goal once the tier target is reached.
  const nextMilestone = useMemo(() => finalTop * 2, [finalTop]);

  // Progress toward the tier target, by doublings (2 → target).
  const progress = useMemo(() => {
    const steps = Math.log2(target) - 1; // doublings from 2 up to the target
    const log = Math.log2(Math.max(2, finalTop));
    return Math.max(0, Math.min(1, (log - 1) / steps));
  }, [finalTop, target]);

  const statusMsg = over
    ? "No moves left — game over"
    : won && !continued
      ? `🎉 You reached ${target}!`
      : won
        ? `Next milestone: reach ${nextMilestone}`
        : "";

  // Screen-reader status: concise board summary + state. When the host is NOT
  // showing its unified timer, include the elapsed time here so the running
  // clock is still announced; when hostTimer is true we suppress it to avoid a
  // duplicate readout (the host owns the visible/announced timer).
  const timeSuffix =
    !hostTimer && (won || over || score > 0)
      ? ` Time ${(elapsedMs / 1000).toFixed(0)} seconds.`
      : "";
  const srStatus =
    (over
      ? `Game over. Final score ${score}. Best tile ${finalTop}.`
      : won
        ? `You reached ${target}. Score ${score}.`
        : `Score ${score}. Largest tile ${finalTop}.`) + timeSuffix;

  // Subtle directional shift used to acknowledge a rejected move.
  const nudgeTransform = (() => {
    if (!nudge || reducedMotion) return undefined;
    const d = 5;
    switch (nudge) {
      case "U":
        return `translateY(-${d}px)`;
      case "D":
        return `translateY(${d}px)`;
      case "L":
        return `translateX(-${d}px)`;
      case "R":
        return `translateX(${d}px)`;
    }
  })();

  // Size the square board to the height left between the fixed chrome (header,
  // score cards, progress, status, dir-pad, undo/restart) and the viewport, so
  // the whole game fits on a phone without scrolling. SIZE×SIZE = 4×4; 332 is
  // the prior desktop max board width.
  const { ref: boardFitRef, size: boardSize } = useFitBox<HTMLDivElement>(SIZE, SIZE, 332);

  // Geometry for the absolutely-positioned tile layer. Cells are laid out on a
  // 4×4 grid inside a square board with a fixed gap and inset padding; tiles are
  // positioned via percentage left/top and animated with CSS transitions.
  const GAP_PCT = 100 / (SIZE * 8 + (SIZE + 1)); // gap relative to inner board width
  const cellPct = (100 - GAP_PCT * (SIZE + 1)) / SIZE;
  const cellPos = (n: number) => GAP_PCT + n * (cellPct + GAP_PCT);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      <p className="sr-only" aria-live="polite">
        {srStatus}
      </p>

      {/* Header: title + how-to-play hint */}
      <div
        className={cn(
          "flex w-[min(92vw,332px)] shrink-0 flex-col items-center",
          !reducedMotion && "animate-rise",
        )}
      >
        <h1 className="font-display text-[17px] font-semibold leading-none text-[#f3f7ff] sm:text-[20px]">2048</h1>
        <p
          className="mt-0.5 font-mono text-[9.5px] tracking-[0.16em] sm:text-[10.5px]"
          style={{ color: ACCENT.soft }}
        >
          MERGE UP TO {target}
        </p>
      </div>

      {/* Score cards */}
      <div className="relative mt-2 flex w-[min(92vw,332px)] shrink-0 items-stretch justify-center gap-3 sm:mt-3">
        <ScoreCard label="SCORE" value={score} color={ACCENT.solid} reducedMotion={reducedMotion} />
        <ScoreCard label="BEST" value={best} color="#00e5ff" reducedMotion={reducedMotion} />
        {gainPulse && !reducedMotion && (
          <span
            key={gainPulse.id}
            aria-hidden
            className="pointer-events-none absolute -top-1 left-1/4 -translate-x-1/2 font-display text-[15px] font-bold"
            style={{ color: ACCENT.soft, animation: "g2048Gain 0.7s ease-out both" }}
            onAnimationEnd={() => setGainPulse(null)}
          >
            +{gainPulse.amount}
          </span>
        )}
      </div>

      {/* Progress toward 2048 */}
      <div
        className="mt-2 h-1 w-[min(92vw,332px)] shrink-0 overflow-hidden rounded-pill bg-white/[0.06] sm:mt-3"
        role="presentation"
      >
        <div
          className={cn("h-full rounded-pill", !reducedMotion && "transition-[width] duration-300")}
          style={{
            width: `${progress * 100}%`,
            backgroundImage: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
          }}
        />
      </div>

      {/* Status message */}
      <div
        className="mt-2 min-h-[16px] shrink-0 text-center font-mono text-[11.5px] sm:mt-3 sm:min-h-[18px] sm:text-[12.5px]"
        style={{ color: over ? "#ff9e3d" : ACCENT.soft }}
        aria-hidden
      >
        {statusMsg}
      </div>

      {/* Board — flexes to the height left between the fixed chrome above and the
          controls below; sized square by useFitBox so it never forces scroll. */}
      <div ref={boardFitRef} className="mt-1.5 flex min-h-0 w-full flex-1 items-center justify-center">
      <div
        className={cn(over && !reducedMotion && "animate-shake")}
        style={{ transform: nudgeTransform, transition: nudge ? "transform 0.08s ease-out" : "transform 0.12s ease-out" }}
      >
        <div
          className="relative rounded-[14px]"
          style={{
            width: boardSize?.w,
            height: boardSize?.h,
            background: "rgba(155,140,255,0.08)",
            border: "1px solid rgba(155,140,255,0.18)",
            boxShadow: `0 18px 50px -22px ${ACCENT.solid}55, inset 0 0 40px -30px ${ACCENT.solid}`,
            touchAction: "none",
          }}
          role="grid"
          aria-label="2048 board"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Static cell backgrounds (also the accessible grid cells). */}
          {Array.from({ length: CELLS }, (_, i) => {
            const r = Math.floor(i / SIZE);
            const c = i % SIZE;
            // Labels read the logical (synchronously-committed) board so screen
            // readers describe the real post-move state, not the stale visual grid.
            const v = labelGrid[i];
            return (
              <div
                key={i}
                role="gridcell"
                aria-label={
                  v === 0
                    ? `Row ${r + 1} column ${c + 1}, empty`
                    : `Row ${r + 1} column ${c + 1}, ${v}`
                }
                className="absolute rounded-[9px]"
                style={{
                  left: `${cellPos(c)}%`,
                  top: `${cellPos(r)}%`,
                  width: `${cellPct}%`,
                  height: `${cellPct}%`,
                  background: "rgba(255,255,255,0.035)",
                }}
              />
            );
          })}

          {/* Animated tile layer. Each tile is absolutely positioned and slides
              via a CSS transition on left/top; spawn/merge add scale accents. */}
          {tiles.map((t) => {
            const r = Math.floor(t.cell / SIZE);
            const c = t.cell % SIZE;
            const [bg, fg] = colorFor(t.value);
            const animName = t.spawn ? "g2048Spawn" : t.pop ? "g2048Merge" : undefined;
            return (
              <div
                key={t.id}
                aria-hidden
                className="absolute flex select-none items-center justify-center break-all rounded-[9px] text-center font-display font-bold tabular-nums"
                style={{
                  left: `${cellPos(c)}%`,
                  top: `${cellPos(r)}%`,
                  width: `${cellPct}%`,
                  height: `${cellPct}%`,
                  background: bg,
                  color: fg,
                  fontSize: tileFontSize(t.value),
                  boxShadow: [tileRing(t.value), tileGlow(t.value)].filter(Boolean).join(", "),
                  zIndex: t.pop ? 3 : t.spawn ? 2 : 1,
                  transition: reducedMotion
                    ? undefined
                    : `left ${SLIDE_MS}ms ease-in-out, top ${SLIDE_MS}ms ease-in-out, background-color 150ms, color 150ms`,
                  animation: animName
                    ? animName === "g2048Spawn"
                      ? `g2048Spawn ${POP_MS}ms ease-out both`
                      : `g2048Merge ${POP_MS}ms cubic-bezier(.2,.7,.2,1) both`
                    : undefined,
                }}
              >
                {t.value}
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {/* Directional controls */}
      <div
        className="mt-2 grid shrink-0 gap-1.5 [grid-template-columns:repeat(3,46px)] [grid-template-rows:repeat(2,46px)] sm:mt-3 sm:gap-2.5 sm:[grid-template-columns:repeat(3,56px)] sm:[grid-template-rows:repeat(2,56px)]"
        role="group"
        aria-label="Directional controls"
      >
        <DirButton dir="U" label="Move up" symbol="↑" onMove={doMove} disabled={locked} reducedMotion={reducedMotion} className="col-start-2" />
        <DirButton dir="L" label="Move left" symbol="←" onMove={doMove} disabled={locked} reducedMotion={reducedMotion} className="col-start-1 row-start-2" />
        <DirButton dir="D" label="Move down" symbol="↓" onMove={doMove} disabled={locked} reducedMotion={reducedMotion} className="col-start-2 row-start-2" />
        <DirButton dir="R" label="Move right" symbol="→" onMove={doMove} disabled={locked} reducedMotion={reducedMotion} className="col-start-3 row-start-2" />
      </div>

      <p className="mt-1.5 shrink-0 font-mono text-[9.5px] sm:mt-2.5 sm:text-[10.5px]" style={{ color: "rgba(226,234,255,0.4)" }}>
        Arrow keys, WASD, or swipe
      </p>

      {/* Undo + Restart */}
      <div className="mt-1.5 flex shrink-0 items-center gap-2.5 sm:mt-2.5">
        <button
          type="button"
          onClick={undo}
          disabled={!undoAvailable || locked}
          aria-label="Undo last move"
          className={cn(
            "inline-flex min-h-[38px] items-center gap-1.5 rounded-pill border px-5 py-1.5 font-display text-[13px] text-[#eaf1ff] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[44px] sm:py-2",
            !reducedMotion && "transition-transform active:scale-[0.98]",
          )}
          style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)" }}
        >
          <span aria-hidden>↩</span> Undo
        </button>
        <button
          type="button"
          onClick={restart}
          aria-label="Restart this puzzle"
          className={cn(
            "inline-flex min-h-[38px] items-center gap-1.5 rounded-pill border px-5 py-1.5 font-display text-[13px] text-[#eaf1ff] sm:min-h-[44px] sm:py-2",
            !reducedMotion && "transition-transform active:scale-[0.98]",
          )}
          style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)" }}
        >
          <span aria-hidden>↻</span> Restart
        </button>
      </div>

      {locked && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={cn(
            "mt-1.5 min-h-[38px] shrink-0 rounded-pill border px-6 py-1.5 font-display text-[13.5px] text-[#eaf1ff] sm:mt-2.5 sm:min-h-[44px] sm:py-2.5",
            !reducedMotion && "transition-transform active:scale-[0.98]",
          )}
          style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)" }}
        >
          View result
        </button>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        won={won}
        eyebrow={won ? `TILE ${target} REACHED` : "GAME OVER"}
        title={won ? "You did it." : "Nice run."}
        statValue={String(score)}
        statLabel="SCORE"
        insight={INSIGHT}
        onReplay={restart}
        replayLabel="Play again"
        extra={
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.1em]" style={{ color: ACCENT.soft }}>
              <span>BEST TILE {finalTop}</span>
              <span aria-hidden style={{ color: "rgba(226,234,255,0.3)" }}>·</span>
              <span style={{ color: "#00e5ff" }}>BEST SCORE {best}</span>
            </div>
            {won && !over && !continued && (
              <button
                type="button"
                onClick={keepPlaying}
                className={cn(
                  "min-h-[44px] rounded-pill border px-6 py-2 font-display text-[13px] text-[#eaf1ff] outline-none",
                  !reducedMotion && "transition-transform active:scale-[0.98]",
                )}
                style={{ borderColor: `${ACCENT.solid}66`, background: `${ACCENT.solid}1f` }}
              >
                Keep playing — chase {nextMilestone} →
              </button>
            )}
          </div>
        }
        share={`BrainTap · 2048\n${
          won ? `Reached ${target}! 🟪` : `Best tile ${finalTop} · Score ${score}`
        }\n\nbraintap.app/games`}
      />

      <style>{`
        @keyframes g2048Merge {
          0% { transform: scale(1); filter: brightness(1); }
          55% { transform: scale(1.18); filter: brightness(1.4); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes g2048Spawn {
          0% { transform: scale(0.1); opacity: 0; }
          60% { opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g2048Gain {
          0% { transform: translate(-50%, 0); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(-50%, -22px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  color,
  reducedMotion,
}: {
  label: string;
  value: number;
  color: string;
  reducedMotion: boolean;
}) {
  // Brief "tick" highlight whenever the value increases.
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current && !reducedMotion) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 180);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value, reducedMotion]);

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center rounded-[14px] px-[18px] py-1.5 sm:py-2.5"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div
        className={cn(
          "font-display text-[22px] font-semibold leading-none tabular-nums sm:text-[26px]",
          !reducedMotion && "transition-transform duration-150",
          bump && "scale-110",
        )}
        style={{ color }}
      >
        {value}
      </div>
      <div
        className="mt-[3px] font-mono text-[9px] tracking-[0.14em] sm:mt-[5px] sm:text-[9.5px]"
        style={{ color: "rgba(226,234,255,0.45)" }}
      >
        {label}
      </div>
    </div>
  );
}

function DirButton({
  dir,
  label,
  symbol,
  onMove,
  disabled,
  className,
  reducedMotion,
}: {
  dir: Direction;
  label: string;
  symbol: string;
  onMove: (d: Direction) => void;
  disabled: boolean;
  className?: string;
  reducedMotion: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => onMove(dir)}
      className={cn(
        "flex h-[46px] w-[46px] touch-manipulation items-center justify-center rounded-[12px] text-lg text-[#eafcff] disabled:opacity-40 sm:h-[56px] sm:w-[56px] sm:text-xl",
        !reducedMotion && "transition-transform active:scale-90",
        className,
      )}
      style={{
        background: "rgba(155,140,255,0.14)",
        border: "1px solid rgba(155,140,255,0.22)",
      }}
    >
      {symbol}
    </button>
  );
}
