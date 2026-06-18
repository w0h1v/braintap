/** Skeleton placeholder for the Stats page (brain profile + radar + bars). */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.06] ${className}`}
      aria-hidden
    />
  );
}

export default function StatsLoading() {
  return (
    <div
      className="mx-auto max-w-shell px-6 pb-24 pt-28 sm:px-8 sm:pt-32"
      role="status"
      aria-live="polite"
    >
      {/* header */}
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.26em] text-cyan-soft">
          <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
          <span>Your brain profile</span>
        </div>
        <Bar className="mt-5 h-10 w-[320px] max-w-full" />
        <Bar className="mt-5 h-4 w-[520px] max-w-full" />
        <Bar className="mt-2.5 h-4 w-[420px] max-w-full" />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Bar key={i} className="h-6 w-28 !rounded-pill" />
          ))}
        </div>
      </div>

      {/* stat strip */}
      <div className="mt-10 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-line bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)] p-5"
          >
            <Bar className="h-8 w-20" />
            <Bar className="mt-3 h-3 w-16" />
          </div>
        ))}
      </div>

      {/* radar + bars */}
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)] p-6 sm:p-8">
          <Bar className="h-3 w-24" />
          <div className="mx-auto mt-4 aspect-square w-full max-w-[380px]">
            <Bar className="h-full w-full !rounded-full" />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)] p-6 sm:p-8">
          <Bar className="h-3 w-24" />
          <div className="mt-5 flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <Bar className="h-3 w-24" />
                  <Bar className="h-3 w-8" />
                </div>
                <Bar className="mt-1.5 h-2 w-full !rounded-pill" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Loading your stats…</span>
    </div>
  );
}
