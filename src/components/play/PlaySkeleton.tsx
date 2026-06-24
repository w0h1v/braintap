/**
 * Loading skeleton for a game route. Mirrors GameHost's frame (back link,
 * header, tier bar, board) so entering `/play/[game]` reads as "loading" rather
 * than a blank content area during the Suspense/hydration beat.
 *
 * Used in two places that both need it: the route-level `loading.tsx`, and the
 * explicit `<Suspense fallback>` in `page.tsx` that wraps the client-side
 * `useSearchParams` read (which otherwise bails out to an empty boundary).
 *
 * Pure markup (no hooks/interactivity), so it works as a server component.
 */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.06] ${className}`}
      aria-hidden
    />
  );
}

export function PlaySkeleton() {
  return (
    <div
      className="mx-auto max-w-shell px-4 pt-24 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6"
      role="status"
      aria-live="polite"
    >
      {/* header: back link + game title */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Bar className="h-9 w-24 !rounded-xl" />
        <div className="flex items-center gap-2.5">
          <Bar className="h-6 w-6 !rounded-md" />
          <div className="flex flex-col items-end gap-1.5">
            <Bar className="h-4 w-28" />
            <Bar className="h-2.5 w-14" />
          </div>
        </div>
      </div>

      {/* insight teaser */}
      <Bar className="mb-4 h-11 w-full !rounded-xl" />

      {/* difficulty tier bar + timer */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-pill border border-line bg-white/[0.02] p-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Bar key={i} className="h-7 w-[72px] !rounded-pill" />
          ))}
        </div>
        <Bar className="h-7 w-[88px] !rounded-pill" />
      </div>

      {/* board panel */}
      <div className="rounded-3xl border border-line bg-gradient-to-b from-[rgba(11,15,31,0.65)] to-[rgba(6,8,18,0.6)] p-3 sm:p-6">
        <div className="mx-auto flex max-w-[420px] flex-col items-center gap-2.5 py-6">
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex w-full justify-center gap-2.5">
              {Array.from({ length: 5 }).map((_, c) => (
                <Bar key={c} className="aspect-square w-[18%] max-w-[58px] !rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading puzzle…</span>
    </div>
  );
}
