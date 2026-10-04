import { MAX_IMPOSTERS, MAX_PLAYERS, MIN_PLAYERS, MODES } from '../modes';
import type { GameConfig, Player, WordSource } from '../types';
import { charLength, cleanText, MAX_NAME_LENGTH, normalizeKey } from './text';
import { resolveCategoryPool } from './words';

export type SetupIssue =
  | 'tooFewPlayers'
  | 'tooManyPlayers'
  | 'blankName'
  | 'nameTooLong'
  | 'duplicateName'
  | 'duplicateId'
  | 'tooFewImposters'
  | 'tooManyImposters'
  | 'categoryMissing'
  | 'categoryEmpty'
  | 'needsTwoWords'
  | 'noCategoriesEnabled';

/**
 * Largest number of imposters for `playerCount` players. The non-imposter side
 * (excluding a Jester) must strictly outnumber the imposters, capped at 3.
 *   3 → 1, 4 → 1, 5 → 2, 6 → 2, 7+ → 3   (one less slot if Jester is on)
 */
export function maxImposters(playerCount: number, config: Pick<GameConfig, 'roles'>): number {
  const jester = config.roles.jester ? 1 : 0;
  const byRatio = Math.floor((playerCount - jester - 1) / 2);
  return Math.max(0, Math.min(MAX_IMPOSTERS, byRatio));
}

/** Smallest player count allowing the Jester alongside one imposter. */
export const MIN_PLAYERS_FOR_JESTER = 4;

export function validatePlayers(players: readonly Player[]): SetupIssue[] {
  const issues = new Set<SetupIssue>();
  if (players.length < MIN_PLAYERS) issues.add('tooFewPlayers');
  if (players.length > MAX_PLAYERS) issues.add('tooManyPlayers');
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const p of players) {
    const name = cleanText(p.name ?? '');
    if (name.length === 0) issues.add('blankName');
    if (charLength(name) > MAX_NAME_LENGTH) issues.add('nameTooLong');
    const key = normalizeKey(name);
    if (key.length > 0) {
      if (names.has(key)) issues.add('duplicateName');
      names.add(key);
    }
    if (ids.has(p.id)) issues.add('duplicateId');
    ids.add(p.id);
  }
  return [...issues];
}

export function validateSetup(players: readonly Player[], config: GameConfig, source: WordSource): SetupIssue[] {
  const issues = validatePlayers(players);
  if (config.imposterCount < 1) issues.push('tooFewImposters');
  if (players.length >= MIN_PLAYERS && config.imposterCount > maxImposters(players.length, config)) {
    issues.push('tooManyImposters');
  }
  const pool = resolveCategoryPool(config.categoryId, source, config);
  if (pool === null) issues.push('categoryMissing');
  else if (pool.words.length === 0) issues.push(pool.kind === 'single' ? 'categoryEmpty' : 'noCategoriesEnabled');
  else if (MODES[config.mode].needsAltWord && !canProvideAltWord(pool.words.length, pool.hasRelated)) {
    issues.push('needsTwoWords');
  }
  return issues;
}

function canProvideAltWord(wordCount: number, hasRelated: boolean): boolean {
  return hasRelated || wordCount >= 2;
}
