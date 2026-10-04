import { MIXED_CATEGORY, RANDOM_CATEGORY } from '../../data/words/categories';
import type { Difficulty, WordEntry } from '../../data/words/types';
import type { CategorySource, GameConfig, SecretWord, WordSource } from '../types';
import { pick, type Rng, shuffle } from './rng';
import { normalizeKey } from './text';

export interface CategoryPool {
  kind: 'single' | 'random' | 'mixed';
  categories: CategorySource[];
  words: WordEntry[];
  /** At least one word has a related word (needed for Undercover without 2+ words). */
  hasRelated: boolean;
}

/** Resolve the configured category id into the set of usable words, or null if it doesn't exist. */
export function resolveCategoryPool(categoryId: string, source: WordSource): CategoryPool | null {
  if (categoryId === RANDOM_CATEGORY || categoryId === MIXED_CATEGORY) {
    const categories = source.categories.filter((c) => !c.custom && c.words.length > 0);
    const words = categories.flatMap((c) => c.words);
    return {
      kind: categoryId === RANDOM_CATEGORY ? 'random' : 'mixed',
      categories,
      words,
      hasRelated: words.some((w) => w.related.length > 0),
    };
  }
  const category = source.categories.find((c) => c.id === categoryId);
  if (!category) return null;
  const words = category.words.filter((w) => w.word.trim().length > 0);
  return {
    kind: 'single',
    categories: [category],
    words,
    hasRelated: words.some((w) => w.related.length > 0),
  };
}

export type PickWordError = 'categoryMissing' | 'categoryEmpty' | 'needsTwoWords';

export interface PickedWord {
  secret: SecretWord;
  altWord: string | null;
  guessChoices: string[];
}

export const GUESS_CHOICE_COUNT = 6;

export function pickWord(
  config: Pick<GameConfig, 'categoryId' | 'difficulty'>,
  source: WordSource,
  rng: Rng,
  options: { needsAltWord: boolean; recentKeys?: readonly string[] },
): { ok: true; value: PickedWord } | { ok: false; error: PickWordError } {
  const pool = resolveCategoryPool(config.categoryId, source);
  if (!pool) return { ok: false, error: 'categoryMissing' };
  if (pool.words.length === 0) return { ok: false, error: 'categoryEmpty' };

  let category: CategorySource | undefined;
  let candidates: WordEntry[];
  if (pool.kind === 'random') {
    category = pick(rng, pool.categories);
    candidates = category ? category.words.slice() : [];
  } else {
    candidates = pool.words.slice();
  }
  if (candidates.length === 0) return { ok: false, error: 'categoryEmpty' };

  const categoryOf = (w: WordEntry): CategorySource | undefined =>
    category ?? pool.categories.find((c) => c.id === w.categoryId);
  const siblingsOf = (w: WordEntry): readonly WordEntry[] => categoryOf(w)?.words ?? candidates;

  const canAlt = (w: WordEntry): boolean =>
    w.related.some((r) => normalizeKey(r) !== normalizeKey(w.word)) ||
    siblingsOf(w).some((s) => normalizeKey(s.word) !== normalizeKey(w.word));

  if (options.needsAltWord) {
    candidates = candidates.filter(canAlt);
    if (candidates.length === 0) return { ok: false, error: 'needsTwoWords' };
  }

  candidates = preferNonEmpty(candidates, (w) => w.difficulty === config.difficulty);
  const recent = new Set(options.recentKeys ?? []);
  candidates = preferNonEmpty(candidates, (w) => !recent.has(w.key));

  const chosen = pick(rng, candidates)!;
  const chosenKey = normalizeKey(chosen.word);
  const siblings = siblingsOf(chosen).filter((s) => normalizeKey(s.word) !== chosenKey);

  let altWord: string | null = null;
  if (options.needsAltWord) {
    const related = chosen.related.filter((r) => normalizeKey(r) !== chosenKey);
    altWord = related.length > 0 ? pick(rng, related)! : (pick(rng, siblings)?.word ?? null);
    if (altWord === null) return { ok: false, error: 'needsTwoWords' };
  }

  const guessChoices = buildGuessChoices(rng, chosen, siblings, altWord);
  const cat = categoryOf(chosen);
  return {
    ok: true,
    value: {
      secret: {
        key: chosen.key,
        word: chosen.word,
        categoryId: cat?.id ?? chosen.categoryId,
        categoryName: cat?.name ?? '',
      },
      altWord,
      guessChoices,
    },
  };
}

function preferNonEmpty<T>(items: T[], predicate: (item: T) => boolean): T[] {
  const filtered = items.filter(predicate);
  return filtered.length > 0 ? filtered : items;
}

/** Secret word plus up to 5 plausible decoys (related words first, then same-category words). */
function buildGuessChoices(
  rng: Rng,
  chosen: WordEntry,
  siblings: readonly WordEntry[],
  altWord: string | null,
): string[] {
  const seen = new Set<string>([normalizeKey(chosen.word)]);
  if (altWord) seen.add(normalizeKey(altWord));
  const decoys: string[] = [];
  const consider = (word: string) => {
    const key = normalizeKey(word);
    if (key.length === 0 || seen.has(key) || decoys.length >= GUESS_CHOICE_COUNT - 1) return;
    seen.add(key);
    decoys.push(word);
  };
  shuffle(rng, chosen.related).forEach(consider);
  shuffle(
    rng,
    siblings.map((s) => s.word),
  ).forEach(consider);
  return shuffle(rng, [chosen.word, ...decoys]);
}

export type { Difficulty };
