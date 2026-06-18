import Link from "next/link";

/**
 * Branded 404. Rendered inside the root layout (Nav / Footer present), so it
 * only needs the centered card itself.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-shell items-center justify-center px-6 py-28 sm:px-8">
      <div className="animate-rise w-full max-w-[480px] rounded-2xl border border-line bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)] p-8 text-center shadow-card sm:p-10">
        <div className="flex items-center justify-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.26em] text-cyan-soft">
          <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
          <span>Page not found</span>
        </div>

        <div className="bt-gradient-text mt-6 font-display text-[clamp(64px,14vw,108px)] font-semibold leading-none tracking-[-0.04em]">
          404
        </div>

        <h1 className="mt-4 font-display text-[clamp(22px,4vw,30px)] font-semibold leading-tight tracking-[-0.02em] text-ink">
          This puzzle doesn&apos;t exist.
        </h1>

        <p className="mx-auto mt-4 max-w-[360px] text-[15px] leading-relaxed text-ink-soft">
          The page you&apos;re after may have moved or never existed. Today&apos;s
          fresh set of brain games is just one tap away.
        </p>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-pill bg-gradient-to-r from-cyan to-magenta px-6 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-bg shadow-btn transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
          >
            Today&apos;s puzzles
          </Link>
          <Link
            href="/archive"
            className="inline-flex w-full items-center justify-center rounded-pill border border-line px-6 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-line-strong hover:text-ink sm:w-auto"
          >
            Browse archive
          </Link>
        </div>
      </div>
    </div>
  );
}
