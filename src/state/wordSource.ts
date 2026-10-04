import { useMemo } from 'react';

import { BUILT_IN_CATEGORIES, MIXED_CATEGORY, RANDOM_CATEGORY, WORD_BANK } from '../data/words';
import type { WordEntry } from '../data/words/types';
import { normalizeKey } from '../game/engine/text';
import type { CategorySource, WordSource } from '../game/types';
import { type TFunction, useT } from '../localization';
import { type CustomCategory, useCustomCategories } from './appData';

export function customToSource(c: CustomCategory): CategorySource {
  return {
    id: c.id,
    name: c.name,
    custom: true,
    words: c.words.map((w): WordEntry => ({
      key: `${c.id}:${normalizeKey(w)}`,
      word: w,
      categoryId: c.id,
      difficulty: 'medium',
      related: [],
      tags: [],
    })),
  };
}

export function buildWordSource(t: TFunction, custom: readonly CustomCategory[]): WordSource {
  return {
    categories: [
      ...BUILT_IN_CATEGORIES.map((c) => ({
        id: c.id,
        name: t(`category.${c.id}`),
        custom: false,
        words: WORD_BANK[c.id] ?? [],
      })),
      ...custom.map(customToSource),
    ],
  };
}

export function useWordSource(): WordSource {
  const t = useT();
  const custom = useCustomCategories();
  return useMemo(() => buildWordSource(t, custom), [t, custom]);
}

/** Display info for a configured category id (handles random/mixed/custom/missing). */
export function describeCategory(
  id: string,
  t: TFunction,
  custom: readonly CustomCategory[],
): { emoji: string; name: string; exists: boolean } {
  if (id === RANDOM_CATEGORY) return { emoji: '🎲', name: t('category.random'), exists: true };
  if (id === MIXED_CATEGORY) return { emoji: '🌈', name: t('category.mixed'), exists: true };
  const builtIn = BUILT_IN_CATEGORIES.find((c) => c.id === id);
  if (builtIn) return { emoji: builtIn.emoji, name: t(`category.${builtIn.id}`), exists: true };
  const c = custom.find((x) => x.id === id);
  if (c) return { emoji: c.emoji, name: c.name, exists: true };
  return { emoji: '❔', name: t('config.error.categoryMissing'), exists: false };
}
