export type ShareOutcome = "shared" | "copied" | "failed";

/** Share via the Web Share API, falling back to clipboard. */
export async function shareText(text: string): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      // user cancelled or not allowed — fall through to clipboard
      if ((e as Error)?.name === "AbortError") return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Format milliseconds as M:SS. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
