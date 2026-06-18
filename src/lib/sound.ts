import { useProgress } from "./progress";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!useProgress.getState().settings.sound) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Play a short synth tone. */
export function playTone(freq: number, durationMs = 140, type: OscillatorType = "sine", gain = 0.06): void {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ac.destination);
    const now = ac.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch {
    /* ignore */
  }
}

export const sfx = {
  tap: () => playTone(440, 60, "triangle", 0.04),
  place: () => playTone(523.25, 90, "sine", 0.05),
  correct: () => playTone(659.25, 120, "sine", 0.06),
  wrong: () => playTone(160, 180, "sawtooth", 0.05),
  win: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      setTimeout(() => playTone(f, 200, "sine", 0.06), i * 110),
    );
  },
};
