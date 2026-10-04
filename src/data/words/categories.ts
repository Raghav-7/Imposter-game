import type { BuiltInCategoryId } from './types';

export type CategoryGroup = 'everyday' | 'india' | 'cinema' | 'pop';

export interface BuiltInCategoryMeta {
  id: BuiltInCategoryId;
  emoji: string;
  /** Section the category is listed under (and used by the quick presets). */
  group: CategoryGroup;
}

/** Section order for category lists. Names live in localization (`group.<id>`). */
export const CATEGORY_GROUPS: readonly CategoryGroup[] = ['everyday', 'india', 'cinema', 'pop'];

/** Display order for the category picker. Names live in localization (`category.<id>`). */
export const BUILT_IN_CATEGORIES: readonly BuiltInCategoryMeta[] = [
  { id: 'food', emoji: '🍕', group: 'everyday' },
  { id: 'animals', emoji: '🦁', group: 'everyday' },
  { id: 'objects', emoji: '🧸', group: 'everyday' },
  { id: 'places', emoji: '🏛️', group: 'everyday' },
  { id: 'everyday_life', emoji: '☕', group: 'everyday' },
  { id: 'jobs', emoji: '👩‍🚒', group: 'everyday' },
  { id: 'school', emoji: '🎒', group: 'everyday' },
  { id: 'college', emoji: '🎓', group: 'everyday' },
  { id: 'travel', emoji: '🧳', group: 'everyday' },
  { id: 'countries', emoji: '🌍', group: 'everyday' },
  { id: 'technology', emoji: '💻', group: 'everyday' },
  { id: 'indian_food', emoji: '🍛', group: 'india' },
  { id: 'indian_culture', emoji: '🪔', group: 'india' },
  { id: 'indian_cities', emoji: '🛺', group: 'india' },
  { id: 'tamil_nadu', emoji: '🛕', group: 'india' },
  { id: 'tamil_movies', emoji: '🎞️', group: 'cinema' },
  { id: 'tamil_celebrities', emoji: '⭐', group: 'cinema' },
  { id: 'telugu_cinema', emoji: '🎥', group: 'cinema' },
  { id: 'malayalam_cinema', emoji: '🌴', group: 'cinema' },
  { id: 'bollywood', emoji: '💃', group: 'cinema' },
  { id: 'movies', emoji: '🎬', group: 'cinema' },
  { id: 'tv_shows', emoji: '📺', group: 'cinema' },
  { id: 'celebrities', emoji: '🌟', group: 'cinema' },
  { id: 'cricket', emoji: '🏏', group: 'pop' },
  { id: 'sports', emoji: '⚽', group: 'pop' },
  { id: 'games', emoji: '🎮', group: 'pop' },
  { id: 'brands', emoji: '🏷️', group: 'pop' },
  { id: 'internet_memes', emoji: '😂', group: 'pop' },
];

export const BUILT_IN_CATEGORY_IDS: readonly BuiltInCategoryId[] = BUILT_IN_CATEGORIES.map((c) => c.id);

export function isBuiltInCategoryId(id: string): id is BuiltInCategoryId {
  return (BUILT_IN_CATEGORY_IDS as readonly string[]).includes(id);
}

export type CategoryPreset = 'all' | 'everyday' | 'tamil' | 'pop';

/**
 * Quick presets for which topics Random/Mixed use. Returns the built-in ids to
 * EXCLUDE. "Everyday" suits groups who don't follow films or sport.
 */
export function presetExclusions(preset: CategoryPreset): BuiltInCategoryId[] {
  const enabled = (c: BuiltInCategoryMeta): boolean => {
    switch (preset) {
      case 'everyday':
        return c.group === 'everyday' || c.group === 'india';
      case 'tamil':
        return c.group === 'everyday' || c.group === 'india' || c.id === 'tamil_movies' || c.id === 'tamil_celebrities';
      case 'pop':
        return c.group === 'cinema' || c.group === 'pop';
      default:
        return true;
    }
  };
  return BUILT_IN_CATEGORIES.filter((c) => !enabled(c)).map((c) => c.id);
}

/** Pseudo-categories: "random" picks one category per round; "mixed" pools every word. */
export const RANDOM_CATEGORY = 'random';
export const MIXED_CATEGORY = 'mixed';
