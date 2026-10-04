export const MAX_NAME_LENGTH = 20;
export const MAX_WORD_LENGTH = 40;
export const MAX_CATEGORY_NAME_LENGTH = 30;

/** Trim and collapse internal whitespace. */
export function cleanText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/** Key used to detect duplicate names/words: case-, accent- and spacing-insensitive. */
export function normalizeKey(input: string): string {
  return cleanText(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US');
}

/** Looser key for comparing guesses: ignores punctuation, spaces and a leading "the". */
export function guessKey(input: string): string {
  return normalizeKey(input)
    .replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/**
 * Is a typed guess close enough to the secret word?
 * Exact after normalisation, or a single typo for words of 5+ characters,
 * or two typos for 9+ characters. Singular/plural "s" is tolerated.
 */
export function isGuessCorrect(guess: string, secret: string): boolean {
  const g = guessKey(guess);
  const s = guessKey(secret);
  if (g.length === 0 || s.length === 0) return false;
  if (g === s) return true;
  if (g + 's' === s || s + 's' === g) return true;
  const allowed = s.length >= 9 ? 2 : s.length >= 5 ? 1 : 0;
  return allowed > 0 && levenshtein(g, s) <= allowed;
}

/** Truncate by user-perceived characters (keeps emoji intact). */
export function clampLength(input: string, max: number): string {
  const chars = Array.from(input);
  return chars.length > max ? chars.slice(0, max).join('') : input;
}

export function charLength(input: string): number {
  return Array.from(input).length;
}
