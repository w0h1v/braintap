"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary. Catches render/runtime errors in a segment and
 * shows a friendly, on-brand recovery screen with a `reset()` retry.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for debugging without exposing details in the UI.
    if (typeof console !== "undefined") console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-shell items-center justify-center px-6 py-28 sm:px-8">
      <div className="animate-rise w-full max-w-[480px] rounded-2xl border border-line bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)] p-8 text-center shadow-card sm:p-10">
        <div className="flex items-center justify-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.26em] text-magenta-soft">
          <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-magenta shadow-[0_0_8px_#ff2bd6]" />
          <span>Something glitched</span>
        </div>

        <h1 className="bt-gradient-text mt-5 font-display text-[clamp(28px,5vw,40px)] font-semibold leading-none tracking-[-0.03em]">
          A neuron misfired.
        </h1>

        <p className="mx-auto mt-5 max-w-[380px] text-[15px] leading-relaxed text-ink-soft">
          We hit an unexpected error loading this part of BrainTap. Your streak
          and progress are safe — give it another tap.
        </p>

        {error?.digest ? (
          <p className="mt-4 font-mono text-[10.5px] tracking-[0.08em] text-ink-faint">
            ref: {error.digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex w-full items-center justify-center rounded-pill bg-gradient-to-r from-cyan to-magenta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-bg shadow-btn transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-pill border border-line px-6 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-line-strong hover:text-ink sm:w-auto"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
