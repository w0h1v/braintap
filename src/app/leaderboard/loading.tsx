/** Skeleton placeholder for the Leaderboard page (header + chips + board rows). */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.06] ${className}`}
      aria-hidden
    />
  );
}

export default function LeaderboardLoading() {
  return (
    <div role="status" aria-live="polite">
      {/* header */}
      <section className="mx-auto max-w-shell px-6 pt-28 sm:px-8">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-soft">
            <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
            <span>LEADERBOARD</span>
          </div>
          <Bar className="mt-3 h-11 w-[440px] max-w-full" />
          <Bar className="mt-3 h-11 w-[300px] max-w-full" />
          <Bar className="mt-4 h-4 w-[500px] max-w-full" />
        </div>

        {/* game selector chips */}
        <div className="mt-7 flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Bar key={i} className="h-8 w-28 !rounded-pill" />
          ))}
        </div>
      </section>

      {/* board */}
      <section className="mx-auto max-w-shell px-6 pb-20 pt-8 sm:px-8">
        <div className="rounded-2xl border border-line bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)] p-2 sm:p-3">
          <ul className="divide-y divide-line">
            {Array.from({ length: 10 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3.5 px-3 py-3.5 sm:px-4">
                <Bar className="h-7 w-7 shrink-0 !rounded-full" />
                <Bar className="h-9 w-9 shrink-0 !rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Bar className="h-4 w-32" />
                  <Bar className="mt-2 h-3 w-20" />
                </div>
                <Bar className="h-5 w-12 shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <span className="sr-only">Loading the leaderboard…</span>
    </div>
  );
}
