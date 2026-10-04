/**
 * Deterministic pseudo-random generator (sfc32) seeded with 128 bits.
 *
 * The reducer stays pure: any action that needs randomness carries a `Seed`
 * generated from the platform CSPRNG (see `seed.ts`). Tests can pass fixed seeds
 * for reproducible games.
 */
export type Seed = readonly [number, number, number, number];

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Unbiased integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

export function createRng(seed: Seed): Rng {
  let a = seed[0] >>> 0;
  let b = seed[1] >>> 0;
  let c = seed[2] >>> 0;
  let d = seed[3] >>> 0;
  if ((a | b | c | d) === 0) d = 0x9e3779b9;

  const nextUint32 = (): number => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t >>> 0;
  };

  // Warm up so similar seeds diverge quickly.
  for (let i = 0; i < 15; i++) nextUint32();

  return {
    next: () => nextUint32() / 4294967296,
    int: (maxExclusive: number) => {
      if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) return 0;
      const n = Math.floor(maxExclusive);
      // Rejection sampling removes modulo bias.
      const limit = 4294967296 - (4294967296 % n);
      let x = nextUint32();
      while (x >= limit) x = nextUint32();
      return x % n;
    },
  };
}

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[rng.int(items.length)];
}

/** Picks `count` distinct items (or fewer if not enough exist). */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, Math.max(0, count));
}

/** Seed derived from a simple integer — handy for tests and simulations. */
export function seedFromNumber(n: number): Seed {
  const x = n >>> 0;
  return [x, (x ^ 0x5bd1e995) >>> 0, (x * 2654435761) >>> 0, (x + 0x6d2b79f5) >>> 0];
}
