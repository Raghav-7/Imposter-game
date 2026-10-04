import { randomId } from '../game/engine/seed';
import { MAX_PLAYERS } from '../game/modes';
import { normalizeKey } from '../game/engine/text';
import {
  cleanWordList,
  customCategoriesStore,
  rosterStore,
  sanitizeCustomCategories,
  sanitizeRoster,
  uniqueCategoryName,
  type CustomCategory,
} from './appData';
import { type AppSettings, sanitizeSettings, settingsStore } from './settings';

/** Plain-text backup format for sharing categories, players and settings. No secrets, no stats. */
export interface Backup {
  app: 'imposter-party';
  version: 1;
  categories: { name: string; emoji: string; words: string[] }[];
  players?: string[];
  settings?: Partial<AppSettings>;
}

export function buildBackup(opts: { players: boolean; settings: boolean }): Backup {
  const backup: Backup = {
    app: 'imposter-party',
    version: 1,
    categories: customCategoriesStore.get().map((c) => ({ name: c.name, emoji: c.emoji, words: c.words })),
  };
  if (opts.players) backup.players = rosterStore.get().map((p) => p.name);
  if (opts.settings) {
    const { onboardingDone: _skip, ...rest } = settingsStore.get();
    backup.settings = rest;
  }
  return backup;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses untrusted text. Returns null if it isn't a valid backup. */
export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try {
    // Accept a backup embedded in surrounding text (e.g. a chat message).
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.app !== 'imposter-party' || raw.version !== 1) return null;
  const categories = sanitizeCustomCategories(Array.isArray(raw.categories) ? raw.categories : []).map((c) => ({
    name: c.name,
    emoji: c.emoji,
    words: c.words,
  }));
  const backup: Backup = { app: 'imposter-party', version: 1, categories };
  if (Array.isArray(raw.players)) {
    backup.players = sanitizeRoster(raw.players.map((name) => ({ name })))
      .map((p) => p.name)
      .filter((n) => n.length > 0);
  }
  if (isRecord(raw.settings)) backup.settings = raw.settings as Partial<AppSettings>;
  return backup;
}

/**
 * Merges a backup: categories with the same name get their words merged,
 * new players are appended (no duplicates), settings are applied.
 */
export function applyBackup(backup: Backup, opts: { players: boolean; settings: boolean }) {
  let categoriesTouched = 0;
  customCategoriesStore.set((list) => {
    const next: CustomCategory[] = list.slice();
    for (const c of backup.categories) {
      const existing = next.findIndex((x) => normalizeKey(x.name) === normalizeKey(c.name));
      if (existing >= 0) {
        const cur = next[existing]!;
        next[existing] = { ...cur, words: cleanWordList([...cur.words, ...c.words]), updatedAt: Date.now() };
      } else {
        next.push({
          id: `custom:${randomId()}`,
          name: uniqueCategoryName(c.name, next),
          emoji: c.emoji,
          words: cleanWordList(c.words),
          updatedAt: Date.now(),
        });
      }
      categoriesTouched++;
    }
    return next;
  });

  let playersAdded = 0;
  if (opts.players && backup.players) {
    rosterStore.set((roster) => {
      const taken = new Set(roster.map((p) => normalizeKey(p.name)));
      const next = roster.slice();
      for (const name of backup.players ?? []) {
        if (next.length >= MAX_PLAYERS || taken.has(normalizeKey(name))) continue;
        taken.add(normalizeKey(name));
        next.push({ id: randomId('p_'), name });
        playersAdded++;
      }
      return next;
    });
  }
  if (opts.settings && backup.settings) {
    settingsStore.set((cur) => sanitizeSettings({ ...cur, ...backup.settings, onboardingDone: cur.onboardingDone }));
  }
  return { categories: categoriesTouched, players: playersAdded };
}
