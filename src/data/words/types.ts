export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'] as const;

/**
 * One word in a category file. The category is implied by the file it lives in.
 * `related` lists similar-but-different words used for Undercover mode
 * (e.g. Pizza → Burger) and as decoys in the Imposter's final guess.
 */
export interface WordSeed {
  word: string;
  difficulty: Difficulty;
  related: string[];
  tags?: string[];
}

export type BuiltInCategoryId =
  | 'food'
  | 'animals'
  | 'objects'
  | 'places'
  | 'movies'
  | 'tv_shows'
  | 'games'
  | 'sports'
  | 'technology'
  | 'jobs'
  | 'everyday_life'
  | 'brands'
  | 'celebrities'
  | 'school'
  | 'college'
  | 'travel'
  | 'indian_culture'
  | 'bollywood'
  | 'cricket'
  | 'indian_food'
  | 'indian_cities'
  | 'countries'
  | 'internet_memes'
  | 'tamil_nadu'
  | 'tamil_movies'
  | 'tamil_celebrities'
  | 'telugu_cinema'
  | 'malayalam_cinema';

/** A fully-resolved word with its category attached. */
export interface WordEntry {
  /** Stable key, e.g. "food:pizza". Never shown to players. */
  key: string;
  word: string;
  categoryId: string;
  difficulty: Difficulty;
  related: string[];
  tags: string[];
}
