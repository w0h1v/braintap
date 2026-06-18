import type { GameId } from "@/lib/types";
import { defineGame } from "@/lib/types";
import { GAME_METAS } from "./_meta";

/**
 * Factory for an unimplemented game module so the app builds and the hub
 * renders before each game is fully built. Game agents replace the entire
 * `index.ts` (and add engine/generator/levels/tests) for their game.
 */
export function stubModule(id: GameId) {
  const meta = GAME_METAS[id];
  return defineGame<{ id: GameId }, unknown>({
    meta,
    getDailyPuzzle: () => ({ id }),
    Component: function ComingSoon({ onComplete }) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="font-mono text-xs tracking-[0.2em] text-cyan-soft">
            {meta.category}
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink">{meta.name}</h2>
          <p className="max-w-sm text-sm text-ink-soft">{meta.tagline}</p>
          <p className="mt-2 font-mono text-xs text-ink-mute">Coming soon.</p>
          <button
            type="button"
            onClick={() => onComplete({ status: "played", score: 0 })}
            className="mt-2 rounded-xl border border-line-strong px-4 py-2 font-display text-sm text-ink-soft"
          >
            Mark as seen
          </button>
        </div>
      );
    },
    validatePuzzle: () => true,
  });
}
