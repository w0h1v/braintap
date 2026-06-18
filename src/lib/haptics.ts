import { useProgress } from "./progress";

/** Trigger device vibration (respects the sound setting as a proxy for feedback). */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    if (!useProgress.getState().settings.sound) return;
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
