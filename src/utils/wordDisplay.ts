/**
 * Presentation-only formatting for secret words. The game data is never changed:
 * these helpers only decide how a word is drawn on screen.
 */

/** Small words that stay lowercase inside a title ("Back to the Future", "Leonardo da Vinci"). */
const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'da',
  'de',
  'del',
  'di',
  'for',
  'from',
  'in',
  'into',
  'la',
  'le',
  'nor',
  'of',
  'on',
  'or',
  'per',
  'the',
  'to',
  'van',
  'via',
  'von',
  'vs',
  'with',
]);

/** Two-letter words that are ordinary words, not abbreviations, when typed in capitals. */
const COMMON_SHORT_WORDS = new Set([
  'am',
  'be',
  'do',
  'go',
  'he',
  'hi',
  'is',
  'it',
  'me',
  'my',
  'no',
  'oh',
  'so',
  'up',
  'us',
  'we',
]);

const HAS_LOWER = /\p{Ll}/u;
const HAS_UPPER = /\p{Lu}/u;
const LETTER_RUN = /\p{L}+/gu;

/** Capitalises the first lowercase letter of each hyphen/slash part: "spider-man" → "Spider-Man". */
function capitalizeParts(token: string): string {
  return token
    .split(/([-/])/)
    .map((part) => part.replace(/^([^\p{L}\p{N}]*)(\p{Ll})/u, (_m, pre: string, ch: string) => pre + ch.toUpperCase()))
    .join('');
}

const letterCount = (token: string) => (token.match(/\p{L}/gu) ?? []).length;

/**
 * Title Case for display, without corrupting deliberate casing:
 * - Words that already contain capitals are kept exactly ("iPhone", "McDonald's", "MS Dhoni",
 *   "Back to the Future"); only all-lowercase words are capitalised ("ice cream" → "Ice Cream"),
 *   except small joining words in the middle ("going to the gym" → "Going to the Gym").
 * - Text typed entirely in capitals is shouting, not an acronym, once it is a phrase or has a
 *   5+ letter run: "PIZZA" → "Pizza", "NEW YORK" → "New York". Short single acronyms stay
 *   ("KFC", "IPL", "WALL-E"), and so do two-letter abbreviations inside a phrase ("TV REMOTE" →
 *   "TV Remote").
 * - Text without cased letters (digits, Tamil, Hindi, emoji) is returned unchanged.
 */
export function formatDisplayWord(word: string): string {
  const hasLower = HAS_LOWER.test(word);
  const hasUpper = HAS_UPPER.test(word);
  if (!hasLower && !hasUpper) return word;

  const parts = word.split(/(\s+)/);
  const tokens = parts.filter((p) => p.trim().length > 0);
  const lastIndex = tokens.length - 1;

  if (!hasLower) {
    const longestRun = Math.max(0, ...(word.match(LETTER_RUN) ?? []).map((r) => r.length));
    if (tokens.length === 1 && longestRun <= 4) return word;
  }

  let index = -1;
  return parts
    .map((part) => {
      if (part.trim().length === 0) return part;
      index += 1;
      const inner = index > 0 && index < lastIndex;
      if (hasLower) {
        // Mixed or normal text: only touch words typed entirely in lowercase.
        if (HAS_UPPER.test(part) || !HAS_LOWER.test(part)) return part;
        return inner && MINOR_WORDS.has(part) ? part : capitalizeParts(part);
      }
      const lower = part.toLowerCase();
      if (inner && MINOR_WORDS.has(lower)) return lower;
      if (letterCount(part) <= 2 && !COMMON_SHORT_WORDS.has(lower) && !(index === 0 && MINOR_WORDS.has(lower))) {
        return part;
      }
      return capitalizeParts(lower);
    })
    .join('');
}

export interface WordRun {
  text: string;
  /** The capital that starts a word; drawn larger than the rest. */
  initial: boolean;
}

/**
 * Splits display text into runs so each word's capital initial can be drawn larger:
 * "Ice Cream" → [I] [ce ] [C] [ream]. Only capitals (with any accents) that start a word,
 * or a part after "-" or "/", count, so "Back to the Future" enlarges B and F, and scripts
 * without capitals are never split inside a character cluster.
 */
export function splitInitials(display: string): WordRun[] {
  const runs: WordRun[] = [];
  const re = /(^|[\s\-/])(\p{Lu}\p{M}*)/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(display)) !== null) {
    const start = m.index + m[1]!.length;
    if (start > last) runs.push({ text: display.slice(last, start), initial: false });
    runs.push({ text: m[2]!, initial: true });
    last = start + m[2]!.length;
  }
  if (last < display.length) runs.push({ text: display.slice(last), initial: false });
  return runs;
}

/** Advance widths (1/1000 em) of printable ASCII in the display font (Bricolage Grotesque ExtraBold). */
const ASCII_WIDTHS = [
  223, 303, 381, 633, 647, 992, 754, 187, 329, 329, 456, 534, 212, 359, 252, 365, 670, 360, 613, 611, 638, 615, 662,
  517, 661, 658, 262, 237, 534, 534, 534, 425, 1004, 712, 692, 685, 705, 632, 601, 729, 730, 303, 382, 697, 509, 955,
  790, 725, 654, 726, 688, 658, 579, 733, 682, 1001, 719, 662, 576, 329, 365, 329, 585, 543, 283, 595, 648, 571, 649,
  587, 408, 607, 643, 286, 288, 605, 283, 963, 643, 612, 648, 649, 446, 549, 406, 634, 585, 881, 587, 608, 537, 347,
  277, 347, 534,
];

const COMBINING = /\p{M}/u;

/** Width of one character in em. Unknown scripts get a generous estimate so they never overflow. */
function charEm(ch: string): number {
  const cp = ch.codePointAt(0)!;
  if (cp >= 32 && cp < 127) return ASCII_WIDTHS[cp - 32]! / 1000;
  if (COMBINING.test(ch)) return 0;
  return cp >= 0x1f000 ? 1.15 : 0.8;
}

export interface FitOptions {
  /** Available width in px. */
  width: number;
  /** Largest size for the small letters, in px. */
  maxSize: number;
  minSize: number;
  /** Initial size ÷ small-letter size. */
  ratio: number;
  /** How many lines a long phrase may wrap onto before it shrinks. */
  maxLines: number;
}

/**
 * Font size (px) for the small letters so the longest word fits on one line and the whole
 * phrase fits in `maxLines`, between minSize and maxSize. Below minSize text wraps instead
 * of shrinking further, so it is never clipped.
 */
export function fitWordSize(runs: readonly WordRun[], o: FitOptions): number {
  let total = 0;
  let current = 0;
  let longest = 0;
  for (const run of runs) {
    const scale = run.initial ? o.ratio : 1;
    for (const ch of run.text) {
      const w = charEm(ch) * scale;
      total += w;
      if (/\s/.test(ch)) {
        longest = Math.max(longest, current);
        current = 0;
      } else current += w;
    }
  }
  longest = Math.max(longest, current);
  if (total <= 0 || o.width <= 0) return o.maxSize;
  // A little slack for kerning, rounding and imperfect line breaks.
  const usable = o.width * 0.95;
  const byWord = usable / longest;
  const byPhrase = (usable * o.maxLines * 0.88) / total;
  const size = Math.floor(Math.min(o.maxSize, byWord, byPhrase) * 2) / 2;
  return Math.max(o.minSize, size);
}
