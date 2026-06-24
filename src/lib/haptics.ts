import { useProgress } from "./progress";

/** Trigger device vibration. Gated on the dedicated `haptics` setting (not
 *  `sound`), so muting audio — the common case for public/commute play — keeps
 *  the feel layer alive. A missing flag (legacy saves) counts as enabled. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    if (useProgress.getState().settings.haptics === false) return;
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export const haptics = {
  tap: () => vibrate(12),
  success: () => vibrate(25),
  error: () => vibrate([60, 40, 60]),
  win: () => vibrate([80, 40, 80, 40, 140]),
};
