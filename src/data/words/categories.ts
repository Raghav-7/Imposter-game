import type { BuiltInCategoryId } from './types';

export interface BuiltInCategoryMeta {
  id: BuiltInCategoryId;
  emoji: string;
  /** Category group used to colour tiles. */
  group: 'everyday' | 'pop' | 'india' | 'world';
}

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
  { id: 'travel', emoji: '🧳', group: 'world' },
  { id: 'countries', emoji: '🌍', group: 'world' },
  { id: 'sports', emoji: '⚽', group: 'world' },
  { id: 'technology', emoji: '💻', group: 'world' },
  { id: 'movies', emoji: '🎬', group: 'pop' },
  { id: 'tv_shows', emoji: '📺', group: 'pop' },
  { id: 'games', emoji: '🎮', group: 'pop' },
  { id: 'brands', emoji: '🏷️', group: 'pop' },
  { id: 'celebrities', emoji: '🌟', group: 'pop' },
  { id: 'internet_memes', emoji: '😂', group: 'pop' },
  { id: 'indian_culture', emoji: '🪔', group: 'india' },
  { id: 'indian_food', emoji: '🍛', group: 'india' },
  { id: 'indian_cities', emoji: '🛺', group: 'india' },
  { id: 'bollywood', emoji: '💃', group: 'india' },
  { id: 'cricket', emoji: '🏏', group: 'india' },
];

export const BUILT_IN_CATEGORY_IDS: readonly BuiltInCategoryId[] = BUILT_IN_CATEGORIES.map((c) => c.id);

export function isBuiltInCategoryId(id: string): id is BuiltInCategoryId {
  return (BUILT_IN_CATEGORY_IDS as readonly string[]).includes(id);
}

/** Pseudo-categories: "random" picks one category per round; "mixed" pools every word. */
export const RANDOM_CATEGORY = 'random';
export const MIXED_CATEGORY = 'mixed';
