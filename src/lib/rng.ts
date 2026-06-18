/**
 * Deterministic, seedable pseudo-random number generation.
 *
 * Every game's daily puzzle must be reproducible: the same date always yields
 * the same puzzle for every player. Use `makeRng(seedFromString(...))` and never
 * `Math.random()` inside generators.
 */

/** Hash a string to a 32-bit unsigned integer seed (xmur3). */
export function seedFromString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export interface Rng {
  /** float in [0,1) */
  next(): number;
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** float in [min, max) */
  float(min: number, max: number): number;
  /** random element of an array */
  pick<T>(arr: readonly T[]): T;
  /** Fisher-Yates shuffle (returns a new array) */
  shuffle<T>(arr: readonly T[]): T[];
  /** true with probability p */
  chance(p: number): boolean;
}

/** mulberry32 PRNG wrapped with convenience helpers. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    float: (min, max) => next() * (max - min) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p) => next() < p,
  };
  return rng;
}

/** Convenience: build an Rng directly from any string seed. */
export function rngFromString(str: string): Rng {
  return makeRng(seedFromString(str));
}
