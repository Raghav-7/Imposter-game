import { BUILT_IN_CATEGORIES } from './categories';
import type { BuiltInCategoryId, WordEntry, WordSeed } from './types';

import { words as animals } from './categories/animals';
import { words as bollywood } from './categories/bollywood';
import { words as brands } from './categories/brands';
import { words as celebrities } from './categories/celebrities';
import { words as college } from './categories/college';
import { words as countries } from './categories/countries';
import { words as cricket } from './categories/cricket';
import { words as everydayLife } from './categories/everyday_life';
import { words as food } from './categories/food';
import { words as games } from './categories/games';
import { words as indianCities } from './categories/indian_cities';
import { words as indianCulture } from './categories/indian_culture';
import { words as indianFood } from './categories/indian_food';
import { words as internetMemes } from './categories/internet_memes';
import { words as jobs } from './categories/jobs';
import { words as movies } from './categories/movies';
import { words as objects } from './categories/objects';
import { words as places } from './categories/places';
import { words as school } from './categories/school';
import { words as sports } from './categories/sports';
import { words as technology } from './categories/technology';
import { words as travel } from './categories/travel';
import { words as tvShows } from './categories/tv_shows';
import { words as tamilNadu } from './categories/tamil_nadu';
import { words as tamilMovies } from './categories/tamil_movies';
import { words as tamilCelebrities } from './categories/tamil_celebrities';
import { words as teluguCinema } from './categories/telugu_cinema';
import { words as malayalamCinema } from './categories/malayalam_cinema';

export const RAW_WORDS: Readonly<Record<BuiltInCategoryId, readonly WordSeed[]>> = {
  food,
  animals,
  objects,
  places,
  movies,
  tv_shows: tvShows,
  games,
  sports,
  technology,
  jobs,
  everyday_life: everydayLife,
  brands,
  celebrities,
  school,
  college,
  travel,
  indian_culture: indianCulture,
  bollywood,
  cricket,
  indian_food: indianFood,
  indian_cities: indianCities,
  countries,
  internet_memes: internetMemes,
  tamil_nadu: tamilNadu,
  tamil_movies: tamilMovies,
  tamil_celebrities: tamilCelebrities,
  telugu_cinema: teluguCinema,
  malayalam_cinema: malayalamCinema,
};

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toEntry(categoryId: string, seed: WordSeed): WordEntry {
  return {
    key: `${categoryId}:${slugify(seed.word)}`,
    word: seed.word.trim(),
    categoryId,
    difficulty: seed.difficulty,
    related: seed.related.map((r) => r.trim()).filter((r) => r.length > 0),
    tags: seed.tags ?? [],
  };
}

const bank: Record<string, WordEntry[]> = {};
for (const meta of BUILT_IN_CATEGORIES) {
  bank[meta.id] = (RAW_WORDS[meta.id] ?? []).map((seed) => toEntry(meta.id, seed));
}

/** All built-in words, grouped by category id. */
export const WORD_BANK: Readonly<Record<string, readonly WordEntry[]>> = bank;

export function totalBuiltInWords(): number {
  return Object.values(WORD_BANK).reduce((sum, list) => sum + list.length, 0);
}

export * from './types';
export * from './categories';
