/** Skeleton placeholder for the Archive page (header + day grid). */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.06] ${className}`}
      aria-hidden
    />
  );
}

export default function ArchiveLoading() {
  return (
    <div role="status" aria-live="polite">
      {/* header */}
      <section className="mx-auto max-w-shell px-6 pt-28 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.26em] text-cyan-soft">
              <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
              <span>The Archive</span>
            </div>
            <Bar className="mt-4 h-12 w-[340px] max-w-full" />
            <Bar className="mt-4 h-4 w-[480px] max-w-full" />
            <Bar className="mt-2.5 h-4 w-[380px] max-w-full" />
          </div>
          <Bar className="h-4 w-32" />
        </div>
        <Bar className="mt-5 h-11 w-full !rounded-xl" />
      </section>

      {/* day grid */}
      <section className="mx-auto max-w-shell px-6 pb-20 pt-8 sm:px-8">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-line bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)] p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <Bar className="h-4 w-28" />
                <Bar className="h-3 w-8" />
              </div>
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {Array.from({ length: 15 }).map((_, j) => (
                  <Bar key={j} className="h-6 w-6" />
                ))}
              </div>
              <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3">
                <Bar className="h-3 w-28" />
                <Bar className="h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <span className="sr-only">Loading the archive…</span>
    </div>
  );
}
