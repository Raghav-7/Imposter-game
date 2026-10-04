import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  cleanWordList,
  sanitizeCustomCategories,
  sanitizeRoster,
  splitWordInput,
  uniqueCategoryName,
} from '../../src/state/appData';
import { applyBackup, buildBackup, parseBackup } from '../../src/state/backup';
import { createPersistentStore } from '../../src/state/persistentStore';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../src/state/settings';
import { emptyStats, recordRound, sanitizeStats, winRate } from '../../src/state/stats';
import { STORAGE_KEYS } from '../../src/storage/storage';
import { __testing as loggerTesting } from '../../src/utils/logger';
import { config, idsWithRole, makePlayers, playRoundToResult, startGame, voteFor } from '../helpers';

const imposterOf = (s: Parameters<typeof idsWithRole>[0]) => idsWithRole(s, 'imposter', 'undercover')[0];

describe('statistics', () => {
  it('records a finished round with correct per-player numbers', () => {
    const s = playRoundToResult(startGame(makePlayers(5), config()), voteFor(imposterOf), () => 'wrong');
    const stats = recordRound(emptyStats(), s, 1000);
    expect(stats.totals).toEqual({ rounds: 1, civilianWins: 1, imposterWins: 0, jesterWins: 0 });
    const imp = s.players.find((p) => p.id === idsWithRole(s, 'imposter')[0])!;
    const impStats = stats.players[imp.name.toLowerCase()]!;
    expect(impStats).toMatchObject({
      gamesPlayed: 1,
      wins: 0,
      losses: 1,
      imposterGames: 1,
      timesCaught: 1,
      currentStreak: 0,
    });
    const civ = s.players.find((p) => p.id === idsWithRole(s, 'civilian')[0])!;
    expect(stats.players[civ.name.toLowerCase()]).toMatchObject({
      wins: 1,
      civilianGames: 1,
      civilianWins: 1,
      points: 3,
      bestStreak: 1,
    });
  });

  it('is idempotent per round (no double counting after a restart)', () => {
    const s = playRoundToResult(startGame(makePlayers(4), config()), voteFor(imposterOf), () => 'x');
    const once = recordRound(emptyStats(), s);
    expect(recordRound(once, s)).toBe(once);
  });

  it('tracks successful guesses and streaks across rounds', () => {
    let stats = emptyStats();
    for (let seed = 1; seed <= 3; seed++) {
      const s = playRoundToResult(
        startGame(makePlayers(4), config(), seed),
        voteFor(imposterOf),
        (st) => st.round!.setup.word.word,
      );
      stats = recordRound(stats, s);
    }
    expect(stats.totals.rounds).toBe(3);
    expect(stats.totals.imposterWins).toBe(3);
    const totalGuesses = Object.values(stats.players).reduce((a, p) => a + p.successfulGuesses, 0);
    expect(totalGuesses).toBe(3);
  });

  it('recovers from corrupted stats', () => {
    expect(sanitizeStats(null)).toEqual(emptyStats());
    expect(sanitizeStats({ version: 2 })).toEqual(emptyStats());
    const s = sanitizeStats({
      version: 1,
      totals: { rounds: -5 },
      players: { a: { name: 'A', wins: 'lots', gamesPlayed: 3 } },
    });
    expect(s.totals.rounds).toBe(0);
    expect(s.players.a).toMatchObject({ name: 'A', wins: 0, gamesPlayed: 3 });
    expect(winRate(s.players.a!)).toBe(0);
  });
});

describe('settings / roster / categories sanitising', () => {
  it('settings fall back field-by-field', () => {
    expect(sanitizeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ theme: 'light', haptics: 'yes', revealStyle: 'hold' })).toMatchObject({
      theme: 'light',
      haptics: DEFAULT_SETTINGS.haptics,
      revealStyle: 'hold',
    });
  });

  it('roster: drops invalid entries, fixes duplicate ids, caps at 20', () => {
    const roster = sanitizeRoster([
      { id: 'a', name: '  Raghav  ' },
      { id: 'a', name: 'Arun' },
      { name: 42 },
      'junk',
      ...Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, name: `P${i}` })),
    ]);
    expect(roster[0]).toEqual({ id: 'a', name: 'Raghav' });
    expect(roster[1]!.id).not.toBe('a');
    expect(roster).toHaveLength(20);
    expect(sanitizeRoster(null)).toEqual([]);
  });

  it('word lists: trimmed, de-duplicated case-insensitively, empties removed', () => {
    expect(cleanWordList([' Goa ', 'goa', '', 'Pizza', 7, 'PIZZA', 'Beach'])).toEqual(['Goa', 'Pizza', 'Beach']);
    expect(splitWordInput('Goa, Pizza\nBeach;; Coding')).toEqual(['Goa', 'Pizza', 'Beach', 'Coding']);
  });

  it('custom categories: invalid ones dropped, ids enforced', () => {
    const cats = sanitizeCustomCategories([
      { id: 'custom:1', name: 'My Friends', words: ['Goa'] },
      { id: 'evil', name: 'X', words: 'nope' },
      { name: '' },
    ]);
    expect(cats).toHaveLength(2);
    expect(cats[1]!.id.startsWith('custom:')).toBe(true);
    expect(cats[1]!.words).toEqual([]);
  });

  it('category names are made unique', () => {
    const existing = sanitizeCustomCategories([{ id: 'custom:1', name: 'Friends', words: [] }]);
    expect(uniqueCategoryName('friends', existing)).toBe('friends (2)');
    expect(uniqueCategoryName('Friends', existing, 'custom:1')).toBe('Friends');
  });
});

describe('backup import / export', () => {
  it('parses exports embedded in chat text and rejects junk', () => {
    const text = `Here you go: ${JSON.stringify({ app: 'imposter-party', version: 1, categories: [{ name: 'Goa Trip', emoji: '🏖️', words: ['Beach', 'beach', 'Fort'] }], players: ['A', 'B'] })} enjoy`;
    const b = parseBackup(text)!;
    expect(b.categories[0]!.words).toEqual(['Beach', 'Fort']);
    expect(b.players).toEqual(['A', 'B']);
    expect(parseBackup('{"app":"other","version":1}')).toBeNull();
    expect(parseBackup('not json')).toBeNull();
  });

  it('round-trips through build → parse → apply (merging same-named categories)', () => {
    const b = parseBackup(
      JSON.stringify({ app: 'imposter-party', version: 1, categories: [{ name: 'Office', words: ['Boss'] }] }),
    )!;
    applyBackup(b, { players: false, settings: false });
    applyBackup(
      parseBackup(
        JSON.stringify({ app: 'imposter-party', version: 1, categories: [{ name: 'office', words: ['Coffee'] }] }),
      )!,
      { players: false, settings: false },
    );
    const out = buildBackup({ players: false, settings: false });
    const office = out.categories.filter((c) => c.name.toLowerCase() === 'office');
    expect(office).toHaveLength(1);
    expect(office[0]!.words).toEqual(['Boss', 'Coffee']);
  });
});

describe('persistent store', () => {
  beforeEach(() => AsyncStorage.clear());

  it('loads saved values and recovers from corrupted JSON', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.settings, '{not valid json');
    const store = createPersistentStore(STORAGE_KEYS.settings, sanitizeSettings, () => ({ ...DEFAULT_SETTINGS }));
    await store.hydrate();
    expect(store.get()).toEqual(DEFAULT_SETTINGS);

    store.set((s) => ({ ...s, theme: 'light' }));
    await new Promise((r) => setTimeout(r, 10));
    const again = createPersistentStore(STORAGE_KEYS.settings, sanitizeSettings, () => ({ ...DEFAULT_SETTINGS }));
    await again.hydrate();
    expect(again.get().theme).toBe('light');
  });

  it('survives storage failures', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk on fire'));
    const store = createPersistentStore(STORAGE_KEYS.settings, sanitizeSettings, () => ({ ...DEFAULT_SETTINGS }));
    await expect(store.hydrate()).resolves.toBeUndefined();
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    spy.mockRestore();
  });
});

describe('logger never leaks secrets', () => {
  it('redacts secret-looking context keys', () => {
    expect(loggerTesting.scrub({ word: 'Pizza', secretWord: 'x', role: 'imposter', key: 'ip.settings' })).toEqual({
      word: '[redacted]',
      secretWord: '[redacted]',
      role: '[redacted]',
      key: 'ip.settings',
    });
  });
});
