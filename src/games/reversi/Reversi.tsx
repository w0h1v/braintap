"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { cn } from "@/lib/cn";
import {
  SIZE,
  CELLS,
  EMPTY,
  YOU,
  AI,
  idx,
  rowOf,
  colOf,
  initialBoard,
  legalMoves,
  applyMove,
  chooseAiMove,
  score,
  isGameOver,
  outcomeFor,
  opponent,
  DEFAULT_DIFFICULTY,
  isDifficulty,
  type Board,
  type Player,
  type Difficulty,
  type ReversiPuzzle,
} from "./engine";

const ACCENT = GAME_METAS.reversi.accent;
const INSIGHT = GAME_METAS.reversi.insight;

// Disc accents (cyan = you, magenta = AI) live alongside the game's mint accent.
const YOU_SOLID = "#00e5ff";
const YOU_SOFT = "#9fe9ff";
const AI_SOLID = "#ff2bd6";
const AI_SOFT = "#ffb3ec";

const AI_MOVE_DELAY = 520;
const AI_PASS_DELAY = 700;
const FLIP_MS = 360;

interface ReversiState {
  /** Flat board, 0/1/2 per cell (JSON-serialisable). */
  board: number[];
  turn: Player;
  last: number | null;
  over: boolean;
  /** Whether today's result is locked in. */
  finished: boolean;
  /** Accumulated play time in ms (so resumed games keep their clock). */
  elapsedMs?: number;
  /**
   * Legacy field from before the host owned difficulty — kept readable so old
   * saves never crash, but no longer drives play (the puzzle's tier does).
   */
  difficulty?: Difficulty;
}

const COLS = ["a", "b", "c", "d", "e", "f", "g", "h"];

function discStyle(player: Player): React.CSSProperties {
  if (player === YOU) {
    return {
      background:
        "radial-gradient(circle at 35% 30%, #aef6ff, #00e5ff 60%, #0090c8)",
      boxShadow: "0 2px 6px rgba(0,0,0,.45), 0 0 10px rgba(0,229,255,.28)",
    };
  }
  return {
    background:
      "radial-gradient(circle at 35% 30%, #ffd0f2, #ff2bd6 60%, #b3168f)",
    boxShadow: "0 2px 6px rgba(0,0,0,.45), 0 0 10px rgba(255,43,214,.28)",
  };
}

export function Reversi({
  puzzle,
  dateISO,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
}: GameComponentProps<ReversiPuzzle, ReversiState>) {
  const saved = savedState ?? null;

  // AI strength is set by the host's difficulty tier via the puzzle. Fall back
  // to the historical default for older puzzles that predate tiers.
  const difficulty: Difficulty = isDifficulty(puzzle.aiDifficulty)
    ? puzzle.aiDifficulty
    : DEFAULT_DIFFICULTY;
  // Read difficulty inside async timers without re-creating callbacks.
  const difficultyRef = useRef<Difficulty>(difficulty);
  difficultyRef.current = difficulty;

  const [board, setBoard] = useState<Board>(() =>
    saved?.board ? (saved.board.slice() as Board) : initialBoard(),
  );
  const [turn, setTurn] = useState<Player>(saved?.turn ?? puzzle.firstTurn);
  const [last, setLast] = useState<number | null>(saved?.last ?? null);
  const [over, setOver] = useState<boolean>(saved?.over ?? false);
  const [focused, setFocused] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [practice, setPractice] = useState(saved?.finished ?? false);
  // Cells flipped by the most recent move — drives the flip animation.
  const [flipping, setFlipping] = useState<Set<number>>(() => new Set());
  // Whose move just landed (colour the flips animate toward).
  const [flipColor, setFlipColor] = useState<Player | null>(null);
  // Transient pass banner (cleared on next move).
  const [passNote, setPassNote] = useState<string | null>(null);
  // Coaching: one hint per round surfaces the engine's own top-rated move for
  // you (the cell is highlighted until you move). Resets on new game / tier.
  const [hint, setHint] = useState<number | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  // Whether the AI is mid-think so the board can visibly lock (dim + no taps).
  const [aiThinking, setAiThinking] = useState(false);

  const completedRef = useRef(saved?.finished ?? false);
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBoardRef = useRef<Board>(board);
  // Deterministic AI rng — fresh per mount, seeded from the date.
  const aiRng = useRef(rngFromString(`reversi-ai:${dailySeed("reversi", dateISO)}`));
  // Separate rng for the hint scorer so asking for a hint never perturbs the
  // AI's deterministic move stream.
  const hintRng = useRef(rngFromString(`reversi-hint:${dailySeed("reversi", dateISO)}`));

  // Timing — the host owns the visible timer, but we still measure solve time so
  // result.timeMs is reported. accumulatedRef holds time from prior sessions;
  // startRef marks when the current session's clock began.
  const accumulatedRef = useRef<number>(saved?.elapsedMs ?? 0);
  const startRef = useRef<number>(Date.now());
  const elapsedMs = useCallback(
    () => accumulatedRef.current + (Date.now() - startRef.current),
    [],
  );

  // Detect a host tier switch: the puzzle's AI strength changes. Restart the
  // round so the AI plays at one consistent strength for the new tier.
  const tierSig = `${puzzle.aiDifficulty ?? DEFAULT_DIFFICULTY}`;
  const lastTierSigRef = useRef(tierSig);

  const counts = useMemo(() => score(board), [board]);
  const youMoves = useMemo(() => legalMoves(board, YOU), [board]);
  const youMoveSet = useMemo(() => new Set(youMoves), [youMoves]);

  // Persist resumable state (JSON-serialisable).
  useEffect(() => {
    onPersistState?.({
      board: [...board],
      turn,
      last,
      over,
      finished: completedRef.current,
      elapsedMs: elapsedMs(),
      difficulty,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, turn, last, over, difficulty]);

  // Drive the flip animation: diff the new board against the previous one and
  // animate any cells that changed owner (excluding the freshly placed disc).
  const commitBoard = useCallback(
    (next: Board, placed: number | null, mover: Player) => {
      if (!reducedMotion) {
        const prev = prevBoardRef.current;
        const changed = new Set<number>();
        for (let i = 0; i < CELLS; i++) {
          if (i === placed) continue;
          if (prev[i] !== EMPTY && prev[i] !== next[i]) changed.add(i);
        }
        if (changed.size > 0) {
          setFlipping(changed);
          setFlipColor(mover);
          if (flipTimer.current) clearTimeout(flipTimer.current);
          flipTimer.current = setTimeout(() => {
            setFlipping(new Set());
            setFlipColor(null);
          }, FLIP_MS + 80);
        }
      }
      prevBoardRef.current = next;
      setBoard(next);
    },
    [reducedMotion],
  );

  const finish = useCallback(
    (finalBoard: Board) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const { you, ai } = score(finalBoard);
      const result = outcomeFor(finalBoard);
      // A tie counts as clearing the tier (you didn't lose) so progression
      // isn't blocked; only an outright loss locks the next tier.
      const status = result === "lost" ? "lost" : "won";

      // Score 0..100 from disc differential, centred at 50 for a tie.
      const diff = you - ai; // -64..64
      const normScore = Math.max(0, Math.min(100, Math.round(50 + (diff / 64) * 50)));

      const verb = result === "won" ? "Won" : result === "tie" ? "Tied" : "Lost";
      const shareText = `BrainTap · Reversi\n${verb} ${you}–${ai} vs BrainTap AI\n\n${result === "won" ? "🟦" : result === "tie" ? "🟪" : "🟥"} ${you}–${ai}\nbraintap.app/games`;

      if (result === "won") {
        haptics.win();
        sfx.win();
      } else if (result === "lost") {
        haptics.error();
        sfx.wrong();
      } else {
        haptics.success();
        sfx.correct();
      }

      setOver(true);
      setTimeout(() => setShowModal(true), reducedMotion ? 0 : 600);

      const timeMs = elapsedMs();

      onComplete({
        status,
        score: normScore,
        moves: you + ai - 4,
        timeMs,
        shareText,
        detail: {
          you,
          ai,
          outcome: result,
          aggressiveness: puzzle.aggressiveness,
          difficulty: difficultyRef.current,
        },
      });
    },
    [onComplete, puzzle.aggressiveness, reducedMotion, elapsedMs],
  );

  // Drive turns: passes, AI moves, and end detection.
  const advance = useCallback(
    (b: Board, nextTurn: Player) => {
      if (isGameOver(b)) {
        setTurn(nextTurn);
        finish(b);
        return;
      }
      const myMoves = legalMoves(b, nextTurn);
      if (myMoves.length === 0) {
        // Player with no move passes; opponent must have a move (not game over).
        const after = opponent(nextTurn);
        setPassNote(nextTurn === YOU ? "No move — you pass" : "BrainTap passes — your move");
        setTurn(after);
        if (after === AI) scheduleAi(b);
        return;
      }
      setPassNote(null);
      setTurn(nextTurn);
      if (nextTurn === AI) scheduleAi(b);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finish],
  );

  const scheduleAi = useCallback(
    (b: Board) => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
      const moves = legalMoves(b, AI);
      const delay = reducedMotion ? 60 : moves.length === 0 ? AI_PASS_DELAY : AI_MOVE_DELAY;
      // Lock the board for the think so taps are visibly ignored, not just no-ops.
      setAiThinking(true);
      aiTimer.current = setTimeout(() => {
        const m = chooseAiMove(
          b,
          AI,
          puzzle.aggressiveness,
          aiRng.current,
          difficultyRef.current,
        );
        setAiThinking(false);
        if (m < 0) {
          // AI passes back to the human.
          advance(b, YOU);
          return;
        }
        const next = applyMove(b, rowOf(m), colOf(m), AI);
        sfx.place();
        haptics.tap();
        setLast(m);
        commitBoard(next, m, AI);
        advance(next, YOU);
      }, delay);
    },
    [advance, commitBoard, puzzle.aggressiveness, reducedMotion],
  );

  // On mount / resume: if it's the AI's turn, kick it off.
  useEffect(() => {
    if (over) {
      if (completedRef.current) setShowModal(false);
      return;
    }
    if (turn === AI) scheduleAi(board);
    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
      if (flipTimer.current) clearTimeout(flipTimer.current);
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playYou = useCallback(
    (i: number) => {
      if (over) return;
      if (turn !== YOU) {
        // Soft "not yet" tap so a fast tapper gets feedback while the AI thinks.
        haptics.tap();
        return;
      }
      if (!youMoveSet.has(i)) {
        haptics.error();
        sfx.wrong();
        return;
      }
      setHint(null);
      const next = applyMove(board, rowOf(i), colOf(i), YOU);
      sfx.place();
      haptics.success();
      setLast(i);
      commitBoard(next, i, YOU);
      advance(next, AI);
    },
    [over, turn, youMoveSet, board, advance, commitBoard],
  );

  // One coaching hint per round: surface the engine's own top-rated move for you
  // (uses the AI scorer on your discs). Component-level — no engine change.
  const showHint = useCallback(() => {
    if (over || turn !== YOU || hintUsed || youMoves.length === 0) return;
    const best = chooseAiMove(board, YOU, puzzle.aggressiveness, hintRng.current, "hard");
    if (best < 0) return;
    setHint(best);
    setHintUsed(true);
    setFocused(best);
    haptics.tap();
  }, [over, turn, hintUsed, youMoves.length, board, puzzle.aggressiveness]);

  const reset = useCallback(() => {
    // Only a replay AFTER finishing is "practice" (won't re-record today). A
    // "New game" tapped mid-round must start a fresh, still-recordable round —
    // otherwise the real win can never register (completedRef gates finish()).
    const wasDone = completedRef.current;
    if (aiTimer.current) clearTimeout(aiTimer.current);
    if (flipTimer.current) clearTimeout(flipTimer.current);
    aiRng.current = rngFromString(`reversi-ai:${dailySeed("reversi", dateISO)}`);
    hintRng.current = rngFromString(`reversi-hint:${dailySeed("reversi", dateISO)}`);
    const fresh = initialBoard();
    prevBoardRef.current = fresh;
    accumulatedRef.current = 0;
    startRef.current = Date.now();
    setBoard(fresh);
    setLast(null);
    setOver(false);
    setShowModal(false);
    setFocused(null);
    setFlipping(new Set());
    setFlipColor(null);
    setPassNote(null);
    setHint(null);
    setHintUsed(false);
    setAiThinking(false);
    setPractice(wasDone); // replay-after-finish is practice; mid-round restart is not
    completedRef.current = wasDone;
    setTurn(puzzle.firstTurn);
    if (puzzle.firstTurn === AI) scheduleAi(fresh);
  }, [dateISO, puzzle.firstTurn, scheduleAi]);

  // When the host switches difficulty tier the puzzle's AI strength changes.
  // Restart the round from a fresh board so the AI plays at one consistent
  // strength. The daily board stays canonical (same opening + firstTurn); only
  // AI strength changes, and the clock restarts for the new tier's attempt.
  useEffect(() => {
    if (lastTierSigRef.current === tierSig) return;
    lastTierSigRef.current = tierSig;
    if (aiTimer.current) clearTimeout(aiTimer.current);
    if (flipTimer.current) clearTimeout(flipTimer.current);
    aiRng.current = rngFromString(`reversi-ai:${dailySeed("reversi", dateISO)}`);
    const fresh = initialBoard();
    prevBoardRef.current = fresh;
    accumulatedRef.current = 0;
    startRef.current = Date.now();
    completedRef.current = false;
    setBoard(fresh);
    setLast(null);
    setOver(false);
    setShowModal(false);
    setFocused(null);
    setFlipping(new Set());
    setFlipColor(null);
    setPassNote(null);
    setHint(null);
    setHintUsed(false);
    setAiThinking(false);
    hintRng.current = rngFromString(`reversi-hint:${dailySeed("reversi", dateISO)}`);
    setPractice(false);
    setTurn(puzzle.firstTurn);
    if (puzzle.firstTurn === AI) scheduleAi(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierSig]);

  // Keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        reset();
        return;
      }
      if (e.key === "h" || e.key === "H") {
        showHint();
        return;
      }
      if (over || turn !== YOU) return;
      const cur = focused ?? idx(3, 3);
      let r = rowOf(cur);
      let c = colOf(cur);
      if (e.key === "ArrowUp") (r = (r + SIZE - 1) % SIZE), e.preventDefault();
      else if (e.key === "ArrowDown") (r = (r + 1) % SIZE), e.preventDefault();
      else if (e.key === "ArrowLeft") (c = (c + SIZE - 1) % SIZE), e.preventDefault();
      else if (e.key === "ArrowRight") (c = (c + 1) % SIZE), e.preventDefault();
      else if (e.key === "Enter" || e.key === " ") {
        playYou(cur);
        e.preventDefault();
        return;
      } else return;
      setFocused(idx(r, c));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [over, turn, focused, playYou, reset, showHint]);

  const turnLabel = over ? "—" : turn === YOU ? "You" : "BrainTap";
  const msg = over
    ? "Game over"
    : passNote ?? (turn === YOU ? "Your move" : "BrainTap is thinking…");

  const result = over ? outcomeFor(board) : null;
  const modalTitle =
    result === "won" ? "You flipped the board." : result === "tie" ? "Dead heat." : "AI took it.";
  const modalShare = `BrainTap · Reversi\n${
    result === "won" ? "Won" : result === "tie" ? "Tied" : "Lost"
  } ${counts.you}–${counts.ai} vs BrainTap AI\n\nbraintap.app/games`;

  // Screen-reader status (announced on turn / score change).
  const srStatus = over
    ? `Game over. You ${counts.you}, BrainTap ${counts.ai}. ${
        result === "won" ? "You win." : result === "tie" ? "Tie." : "BrainTap wins."
      }`
    : `${msg}. You ${counts.you}, BrainTap ${counts.ai}.`;

  // Floor the board near full-width on narrow phones so each of the 8 cells
  // clears the 44px tap target: 96vw at 360px ≈ 41px cells with the button as
  // the hit area, vs 92vw which dropped cells under the minimum.
  const BOARD_MAX = "min(96vw, 380px)";

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center",
        !reducedMotion && "animate-rise",
      )}
    >
      <span className="sr-only" role="status" aria-live="polite">
        {srStatus}
      </span>

      {/* Score cards */}
      <div
        className="mb-3 grid w-full grid-cols-2 gap-3"
        style={{ maxWidth: BOARD_MAX }}
      >
        <ScoreCard
          color={YOU_SOLID}
          soft={YOU_SOFT}
          bg="rgba(0,229,255,.08)"
          border="rgba(0,229,255,.28)"
          glow="rgba(0,229,255,.30)"
          disc={YOU}
          value={counts.you}
          label="YOU"
          active={!over && turn === YOU}
          reducedMotion={reducedMotion}
        />
        <ScoreCard
          color={AI_SOLID}
          soft={AI_SOFT}
          bg="rgba(255,43,214,.08)"
          border="rgba(255,43,214,.28)"
          glow="rgba(255,43,214,.30)"
          disc={AI}
          value={counts.ai}
          label="BRAINTAP"
          active={!over && turn === AI}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Turn indicator */}
      <div
        className="mb-3 flex min-h-[18px] items-center justify-center text-center font-mono text-[12.5px]"
        style={{ color: ACCENT.soft }}
        aria-hidden
      >
        <span
          className={cn(
            !reducedMotion && "transition-opacity duration-200",
            !over && turn === AI && !passNote && "inline-flex items-center gap-1.5",
          )}
        >
          {!over && turn === AI && !passNote && !reducedMotion && (
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse2 rounded-full"
              style={{ background: AI_SOLID }}
            />
          )}
          {msg}
        </span>
        <span className="mx-1" style={{ opacity: 0.5 }}>
          · turn:
        </span>
        <span style={{ color: "#eafcff" }}>{turnLabel}</span>
      </div>

      {/* Board */}
      <div
        role="grid"
        aria-label="Reversi board, 8 by 8"
        className={cn(
          "grid aspect-square w-full grid-cols-8 rounded-2xl border p-1",
          !reducedMotion && "transition-opacity duration-200",
          // Visibly lock the board while the AI thinks so taps read as ignored.
          aiThinking && "pointer-events-none opacity-60",
        )}
        style={{
          maxWidth: BOARD_MAX,
          gap: "clamp(2px, 0.7vw, 3px)",
          background: `${ACCENT.solid}1a`,
          borderColor: `${ACCENT.solid}3d`,
          boxShadow: `0 18px 50px -22px ${ACCENT.solid}59, inset 0 0 40px -30px ${ACCENT.solid}`,
        }}
      >
        {Array.from({ length: CELLS }, (_, i) => {
          const r = rowOf(i);
          const c = colOf(i);
          const v = board[i] as Player | 0;
          const legal = !over && turn === YOU && youMoveSet.has(i);
          const isLast = last === i;
          const isFocus = focused === i;
          const isFlipping = flipping.has(i);
          const isHint = hint === i;
          const isCorner =
            (r === 0 || r === SIZE - 1) && (c === 0 || c === SIZE - 1);
          const ariaState =
            v === YOU
              ? "your disc"
              : v === AI
                ? "AI disc"
                : isHint
                  ? "empty, suggested move"
                  : legal
                    ? "empty, legal move"
                    : "empty";
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={`Column ${COLS[c]}, row ${r + 1}, ${ariaState}`}
              tabIndex={legal || isFocus ? 0 : -1}
              onClick={() => playYou(i)}
              onFocus={() => setFocused(i)}
              disabled={!legal}
              className={cn(
                "group relative flex touch-manipulation select-none items-center justify-center rounded-[5px] p-0 outline-none",
                legal ? "cursor-pointer" : "cursor-default",
                !reducedMotion && "transition-colors duration-150",
              )}
              style={{
                background: isHint
                  ? `${ACCENT.solid}26`
                  : isCorner
                    ? `${ACCENT.solid}12`
                    : "rgba(6,20,16,.5)",
                boxShadow: isHint
                  ? `0 0 0 2px ${ACCENT.solid}, 0 0 16px ${ACCENT.solid}99`
                  : isFocus
                    ? `0 0 0 2px ${ACCENT.solid}, 0 0 12px ${ACCENT.solid}66`
                    : isCorner
                      ? `inset 0 0 0 1px ${ACCENT.solid}30`
                      : undefined,
              }}
            >
              {v !== EMPTY &&
                (() => {
                  // Owner shown by colour AND shape so it's legible without
                  // colour: your discs carry a solid centre dot, the AI's a
                  // hollow ring. Track the flip colour mid-animation too.
                  const shownOwner: Player =
                    isFlipping && flipColor ? flipColor : (v as Player);
                  return (
                    <span
                      className={cn(
                        "flex items-center justify-center rounded-full",
                        !reducedMotion && "transition-transform duration-200",
                      )}
                      style={{
                        width: "78%",
                        height: "78%",
                        ...discStyle(shownOwner),
                        transformStyle: "preserve-3d",
                        animation:
                          isFlipping && !reducedMotion
                            ? `btFlip ${FLIP_MS}ms ease both`
                            : !reducedMotion && isLast
                              ? "btPop 0.34s cubic-bezier(.2,.7,.2,1) both"
                              : undefined,
                        ...(isLast
                          ? {
                              outline: `2px solid ${shownOwner === AI ? AI_SOFT : YOU_SOFT}`,
                              outlineOffset: "-2px",
                            }
                          : {}),
                      }}
                    >
                      <span
                        aria-hidden
                        className="block rounded-full"
                        style={
                          shownOwner === YOU
                            ? {
                                width: "30%",
                                height: "30%",
                                background: "rgba(4,16,24,.55)",
                              }
                            : {
                                width: "42%",
                                height: "42%",
                                border: "2px solid rgba(20,4,16,.55)",
                              }
                        }
                      />
                    </span>
                  );
                })()}
              {v === EMPTY && legal && (
                <span
                  className={cn(
                    "block rounded-full",
                    !reducedMotion && "animate-pulse2",
                  )}
                  style={{
                    width: "26%",
                    height: "26%",
                    background: `${ACCENT.solid}80`,
                    boxShadow: `0 0 8px ${ACCENT.solid}66`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-[18px] flex flex-wrap items-center justify-center gap-2.5">
        {over ? (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className={cn(
              "min-h-[44px] rounded-pill border px-6 py-2.5 font-display text-[13.5px] outline-none",
              !reducedMotion && "transition-transform active:scale-95",
            )}
            style={{
              borderColor: `${ACCENT.solid}66`,
              background: `${ACCENT.solid}1f`,
              color: ACCENT.soft,
            }}
          >
            View result
          </button>
        ) : (
          <button
            type="button"
            onClick={showHint}
            disabled={hintUsed || turn !== YOU || youMoves.length === 0}
            aria-label={hintUsed ? "Hint used" : "Show a suggested move"}
            className={cn(
              "min-h-[44px] rounded-pill border px-5 py-2.5 font-display text-[13.5px] outline-none disabled:opacity-40",
              !reducedMotion && "transition-transform active:scale-95",
            )}
            style={{
              borderColor: `${ACCENT.solid}55`,
              background: `${ACCENT.solid}14`,
              color: ACCENT.soft,
            }}
          >
            {hintUsed ? "Hint used" : "💡 Hint"}
          </button>
        )}

        <button
          type="button"
          onClick={reset}
          className={cn(
            "min-h-[44px] rounded-pill border px-6 py-2.5 font-display text-[13.5px] text-[#eaf1ff] outline-none",
            !reducedMotion && "transition-transform active:scale-95",
          )}
          style={{
            borderColor: "rgba(255,255,255,.2)",
            background: "rgba(255,255,255,.04)",
          }}
        >
          New game
        </button>
      </div>

      {practice && !over && (
        <p className="mt-2 font-mono text-[10.5px] tracking-[0.12em] text-ink-faint">
          Practice round — today&apos;s result is locked in
        </p>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        won={result === "won"}
        eyebrow={result === "won" ? "VICTORY" : result === "tie" ? "DEAD HEAT" : "DEFEAT"}
        title={modalTitle}
        insight={INSIGHT}
        share={modalShare}
        onReplay={reset}
        replayLabel="New game"
        extra={
          <div className="flex items-center justify-center gap-7">
            <div className="flex flex-col items-center">
              <span
                className="font-display text-4xl font-semibold tabular-nums"
                style={{ color: YOU_SOLID }}
              >
                {counts.you}
              </span>
              <span className="mt-1 font-mono text-[10px] tracking-[0.1em] text-ink-faint">
                YOU
              </span>
            </div>
            <span className="font-display text-2xl text-ink-faint">–</span>
            <div className="flex flex-col items-center">
              <span
                className="font-display text-4xl font-semibold tabular-nums"
                style={{ color: AI_SOLID }}
              >
                {counts.ai}
              </span>
              <span className="mt-1 font-mono text-[10px] tracking-[0.1em] text-ink-faint">
                BRAINTAP
              </span>
            </div>
          </div>
        }
      />
    </div>
  );
}

function ScoreCard({
  color,
  soft,
  bg,
  border,
  glow,
  disc,
  value,
  label,
  active,
  reducedMotion,
}: {
  color: string;
  soft: string;
  bg: string;
  border: string;
  glow: string;
  disc: Player;
  value: number;
  label: string;
  active: boolean;
  reducedMotion?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-[14px] border px-4 py-2.5 sm:px-5",
        !reducedMotion && "transition-shadow duration-300",
      )}
      style={{
        background: bg,
        borderColor: border,
        boxShadow: active ? `0 0 0 1px ${border}, 0 0 22px ${glow}` : "none",
      }}
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
        style={discStyle(disc)}
        aria-hidden
      >
        <span
          className="block rounded-full"
          style={
            disc === YOU
              ? { width: "30%", height: "30%", background: "rgba(4,16,24,.55)" }
              : { width: "42%", height: "42%", border: "1.5px solid rgba(20,4,16,.55)" }
          }
        />
      </span>
      <div className="flex min-w-0 flex-col leading-none">
        <span
          className="font-display text-[22px] font-semibold tabular-nums"
          style={{ color: "#eafcff" }}
        >
          {value}
        </span>
        <span
          className="mt-0.5 truncate font-mono text-[9px] tracking-[0.08em]"
          style={{ color: soft }}
        >
          {label}
        </span>
      </div>
      {active && (
        <span
          className={cn(
            "ml-auto h-1.5 w-1.5 shrink-0 rounded-full",
            !reducedMotion && "animate-pulse2",
          )}
          style={{ background: color }}
          aria-hidden
        />
      )}
    </div>
  );
}
