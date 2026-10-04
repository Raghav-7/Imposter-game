import { DEFAULT_GAME_CONFIG, sanitizeConfig } from '../game/engine/config';
import { randomId } from '../game/engine/seed';
import {
  charLength,
  cleanText,
  clampLength,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MAX_WORD_LENGTH,
  normalizeKey,
} from '../game/engine/text';
import { MAX_PLAYERS } from '../game/modes';
import type { GameConfig, Player } from '../game/types';
import { STORAGE_KEYS } from '../storage/storage';
import { createPersistentStore, useStore } from './persistentStore';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/* ---------------------------------- roster --------------------------------- */

export function sanitizeRoster(raw: unknown): Player[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const out: Player[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.name !== 'string') continue;
    const name = clampLength(cleanText(item.name), MAX_NAME_LENGTH);
    let id = typeof item.id === 'string' && item.id.length > 0 ? item.id : randomId('p_');
    if (seenIds.has(id)) id = randomId('p_');
    seenIds.add(id);
    out.push({ id, name });
    if (out.length >= MAX_PLAYERS) break;
  }
  return out;
}

export const rosterStore = createPersistentStore(STORAGE_KEYS.roster, sanitizeRoster, () => [] as Player[]);
export const useRoster = () => useStore(rosterStore);

/* ------------------------------ preferred config ---------------------------- */

export const configStore = createPersistentStore(STORAGE_KEYS.config, sanitizeConfig, () => ({
  ...DEFAULT_GAME_CONFIG,
}));
export const useGameConfig = () => useStore(configStore);
export function updateGameConfig(patch: Partial<GameConfig>) {
  configStore.set((prev) => ({ ...prev, ...patch }));
}

/* ----------------------------- custom categories ---------------------------- */

export const CUSTOM_PREFIX = 'custom:';
export const MAX_CUSTOM_WORDS = 1000;
export const MAX_CUSTOM_CATEGORIES = 100;

export interface CustomCategory {
  id: string;
  name: string;
  emoji: string;
  words: string[];
  updatedAt: number;
}

/** Cleans a word list: trimmed, length-limited, de-duplicated (case-insensitive), non-empty. */
export function cleanWordList(words: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (typeof w !== 'string') continue;
    const word = clampLength(cleanText(w), MAX_WORD_LENGTH);
    const key = normalizeKey(word);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= MAX_CUSTOM_WORDS) break;
  }
  return out;
}

/** Splits pasted text ("Goa, Pizza\nBeach") into words. */
export function splitWordInput(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((w) => cleanText(w))
    .filter((w) => w.length > 0);
}

export function sanitizeCustomCategories(raw: unknown): CustomCategory[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomCategory[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item) || typeof item.name !== 'string') continue;
    const name = clampLength(cleanText(item.name), MAX_CATEGORY_NAME_LENGTH);
    if (name.length === 0) continue;
    let id =
      typeof item.id === 'string' && item.id.startsWith(CUSTOM_PREFIX) ? item.id : `${CUSTOM_PREFIX}${randomId()}`;
    if (ids.has(id)) id = `${CUSTOM_PREFIX}${randomId()}`;
    ids.add(id);
    out.push({
      id,
      name,
      emoji: typeof item.emoji === 'string' && charLength(item.emoji) <= 2 && item.emoji.length > 0 ? item.emoji : '✨',
      words: cleanWordList(Array.isArray(item.words) ? item.words : []),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
    });
    if (out.length >= MAX_CUSTOM_CATEGORIES) break;
  }
  return out;
}

export const customCategoriesStore = createPersistentStore(
  STORAGE_KEYS.customCategories,
  sanitizeCustomCategories,
  () => [] as CustomCategory[],
);
export const useCustomCategories = () => useStore(customCategoriesStore);

/** A unique display name: "My Friends", "My Friends (2)", … */
export function uniqueCategoryName(name: string, existing: readonly CustomCategory[], ignoreId?: string): string {
  const base = clampLength(cleanText(name), MAX_CATEGORY_NAME_LENGTH - 4);
  const taken = new Set(existing.filter((c) => c.id !== ignoreId).map((c) => normalizeKey(c.name)));
  if (!taken.has(normalizeKey(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})`;
    if (!taken.has(normalizeKey(candidate))) return candidate;
  }
  return `${base} ${randomId()}`;
}

export function createCustomCategory(name: string, words: string[] = [], emoji = '✨'): CustomCategory {
  const list = customCategoriesStore.get();
  const category: CustomCategory = {
    id: `${CUSTOM_PREFIX}${randomId()}`,
    name: uniqueCategoryName(name, list),
    emoji,
    words: cleanWordList(words),
    updatedAt: Date.now(),
  };
  customCategoriesStore.set([...list, category]);
  return category;
}

export function updateCustomCategory(id: string, patch: Partial<Omit<CustomCategory, 'id'>>) {
  customCategoriesStore.set((list) =>
    list.map((c) => {
      if (c.id !== id) return c;
      return {
        ...c,
        ...patch,
        name: patch.name !== undefined ? uniqueCategoryName(patch.name, list, id) : c.name,
        words: patch.words !== undefined ? cleanWordList(patch.words) : c.words,
        updatedAt: Date.now(),
      };
    }),
  );
}

export function deleteCustomCategory(id: string) {
  customCategoriesStore.set((list) => list.filter((c) => c.id !== id));
  // A deleted category can no longer be the selected one.
  if (configStore.get().categoryId === id) updateGameConfig({ categoryId: DEFAULT_GAME_CONFIG.categoryId });
}

/* -------------------------------- recent words ------------------------------- */

export const RECENT_WORDS_LIMIT = 60;

export function sanitizeRecent(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(-RECENT_WORDS_LIMIT) : [];
}

export const recentWordsStore = createPersistentStore(STORAGE_KEYS.recentWords, sanitizeRecent, () => [] as string[]);

export function rememberWord(key: string) {
  recentWordsStore.set((prev) => [...prev.filter((k) => k !== key), key].slice(-RECENT_WORDS_LIMIT));
}
