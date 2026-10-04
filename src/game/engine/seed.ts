import * as ExpoCrypto from 'expo-crypto';

import type { Seed } from './rng';

/** 128-bit seed from the platform CSPRNG, falling back gracefully if unavailable. */
export function randomSeed(): Seed {
  const buf = new Uint32Array(4);
  try {
    ExpoCrypto.getRandomValues(buf);
  } catch {
    try {
      globalThis.crypto?.getRandomValues?.(buf);
    } catch {
      // Ignore — fall through to Math.random mixing below.
    }
  }
  // Mix in Math.random/time so a broken CSPRNG never yields an all-zero seed.
  const t = Date.now();
  return [
    (buf[0]! ^ Math.floor(Math.random() * 4294967296)) >>> 0,
    (buf[1]! ^ (t >>> 0)) >>> 0,
    (buf[2]! ^ Math.floor(Math.random() * 4294967296)) >>> 0,
    (buf[3]! ^ Math.floor(t / 4294967296)) >>> 0,
  ];
}

/** Short random id (not secret-bearing) for players, rounds and categories. */
export function randomId(prefix = ''): string {
  const [a, b] = randomSeed();
  return `${prefix}${a.toString(36)}${b.toString(36)}`;
}
