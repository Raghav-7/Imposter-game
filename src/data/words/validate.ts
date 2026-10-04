import { BUILT_IN_CATEGORY_IDS } from './categories';
import { DIFFICULTIES, type WordSeed } from './types';

export interface WordIssue {
  category: string;
  word: string;
  problem:
    | 'empty'
    | 'untrimmed'
    | 'tooLong'
    | 'duplicate'
    | 'badDifficulty'
    | 'missingRelated'
    | 'relatedIsSelf'
    | 'duplicateRelated'
    | 'unknownCategory'
    | 'categoryTooSmall'
    | 'difficultyTooSmall';
  detail?: string;
}

export const MAX_BUILT_IN_WORD_LENGTH = 32;
export const MIN_WORDS_PER_CATEGORY = 40;
export const MIN_WORDS_PER_DIFFICULTY = 8;

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Validates the whole built-in word bank. An empty result means the data is clean. */
export function validateWordBank(bank: Readonly<Record<string, readonly WordSeed[]>>): WordIssue[] {
  const issues: WordIssue[] = [];
  const seen = new Map<string, string>();

  for (const [category, words] of Object.entries(bank)) {
    if (!(BUILT_IN_CATEGORY_IDS as readonly string[]).includes(category)) {
      issues.push({ category, word: '', problem: 'unknownCategory' });
    }
    if (words.length < MIN_WORDS_PER_CATEGORY) {
      issues.push({ category, word: '', problem: 'categoryTooSmall', detail: String(words.length) });
    }
    for (const d of DIFFICULTIES) {
      const n = words.filter((w) => w.difficulty === d).length;
      if (n < MIN_WORDS_PER_DIFFICULTY)
        issues.push({ category, word: '', problem: 'difficultyTooSmall', detail: `${d}:${n}` });
    }
    for (const seed of words) {
      const word = typeof seed.word === 'string' ? seed.word : '';
      if (word.trim().length === 0) {
        issues.push({ category, word, problem: 'empty' });
        continue;
      }
      if (word !== word.trim() || /\s{2,}/.test(word)) issues.push({ category, word, problem: 'untrimmed' });
      if (word.length > MAX_BUILT_IN_WORD_LENGTH) issues.push({ category, word, problem: 'tooLong' });
      if (!DIFFICULTIES.includes(seed.difficulty)) issues.push({ category, word, problem: 'badDifficulty' });

      const k = key(word);
      const previous = seen.get(k);
      if (previous !== undefined) issues.push({ category, word, problem: 'duplicate', detail: previous });
      else seen.set(k, category);

      const related = Array.isArray(seed.related) ? seed.related : [];
      const relatedKeys = related.map(key).filter((r) => r.length > 0);
      if (relatedKeys.length === 0) issues.push({ category, word, problem: 'missingRelated' });
      if (relatedKeys.includes(k)) issues.push({ category, word, problem: 'relatedIsSelf' });
      if (new Set(relatedKeys).size !== relatedKeys.length)
        issues.push({ category, word, problem: 'duplicateRelated' });
    }
  }
  return issues;
}
