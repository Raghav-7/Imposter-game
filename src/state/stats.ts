import { cleanText, normalizeKey } from '../game/engine/text';
import { isHunted, roleTeam } from '../game/roles';
import type { GameState } from '../game/types';
import { STORAGE_KEYS } from '../storage/storage';
import { createPersistentStore, useStore } from './persistentStore';

export interface PlayerStats {
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  imposterGames: number;
  imposterWins: number;
  civilianGames: number;
  civilianWins: number;
  jesterGames: number;
  jesterWins: number;
  timesCaught: number;
  successfulGuesses: number;
  points: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayed: number;
}

export interface StatsData {
  version: 1;
  totals: { rounds: number; civilianWins: number; imposterWins: number; jesterWins: number };
  /** Keyed by normalised player name so stats follow a name across games. */
  players: Record<string, PlayerStats>;
  /** Round ids already counted — recording is idempotent across restarts. */
  recordedRounds: string[];
}

export const RECORDED_ROUNDS_LIMIT = 200;

export function emptyStats(): StatsData {
  return {
    version: 1,
    totals: { rounds: 0, civilianWins: 0, imposterWins: 0, jesterWins: 0 },
    players: {},
    recordedRounds: [],
  };
}

export function emptyPlayerStats(name: string): PlayerStats {
  return {
    name,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    imposterGames: 0,
    imposterWins: 0,
    civilianGames: 0,
    civilianWins: 0,
    jesterGames: 0,
    jesterWins: 0,
    timesCaught: 0,
    successfulGuesses: 0,
    points: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayed: 0,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function sanitizeStats(raw: unknown): StatsData {
  if (!isRecord(raw) || raw.version !== 1) return emptyStats();
  const totals = isRecord(raw.totals) ? raw.totals : {};
  const players: Record<string, PlayerStats> = {};
  if (isRecord(raw.players)) {
    for (const [key, value] of Object.entries(raw.players)) {
      if (!isRecord(value) || typeof value.name !== 'string') continue;
      const base = emptyPlayerStats(cleanText(value.name));
      const p = { ...base } as unknown as Record<string, unknown>;
      for (const field of Object.keys(base)) {
        if (field !== 'name') p[field] = count(value[field]);
      }
      players[key] = p as unknown as PlayerStats;
    }
  }
  return {
    version: 1,
    totals: {
      rounds: count(totals.rounds),
      civilianWins: count(totals.civilianWins),
      imposterWins: count(totals.imposterWins),
      jesterWins: count(totals.jesterWins),
    },
    players,
    recordedRounds: Array.isArray(raw.recordedRounds)
      ? raw.recordedRounds.filter((x): x is string => typeof x === 'string').slice(-RECORDED_ROUNDS_LIMIT)
      : [],
  };
}

/** Pure: folds one finished round into the stats. Returns the same object if already recorded. */
export function recordRound(stats: StatsData, game: GameState, now = Date.now()): StatsData {
  const round = game.round;
  const result = round?.result;
  if (!round || !result) return stats;
  if (stats.recordedRounds.includes(round.id)) return stats;

  const players = { ...stats.players };
  for (const player of game.players) {
    const role = round.setup.roles[player.id];
    if (!role) continue;
    const key = normalizeKey(player.name);
    const prev = players[key] ?? emptyPlayerStats(player.name);
    const team = roleTeam(role);
    const won = result.winners.includes(team);
    const caught = isHunted(role) && round.eliminations.some((e) => e.playerId === player.id);
    const guessed = round.guesses.some((g) => g.playerId === player.id && g.correct);
    const streak = won ? prev.currentStreak + 1 : 0;
    players[key] = {
      ...prev,
      name: player.name,
      gamesPlayed: prev.gamesPlayed + 1,
      wins: prev.wins + (won ? 1 : 0),
      losses: prev.losses + (won ? 0 : 1),
      imposterGames: prev.imposterGames + (team === 'imposters' ? 1 : 0),
      imposterWins: prev.imposterWins + (team === 'imposters' && won ? 1 : 0),
      civilianGames: prev.civilianGames + (team === 'civilians' ? 1 : 0),
      civilianWins: prev.civilianWins + (team === 'civilians' && won ? 1 : 0),
      jesterGames: prev.jesterGames + (team === 'jester' ? 1 : 0),
      jesterWins: prev.jesterWins + (team === 'jester' && won ? 1 : 0),
      timesCaught: prev.timesCaught + (caught ? 1 : 0),
      successfulGuesses: prev.successfulGuesses + (guessed ? 1 : 0),
      points: prev.points + (result.scoreDeltas[player.id] ?? 0),
      currentStreak: streak,
      bestStreak: Math.max(prev.bestStreak, streak),
      lastPlayed: now,
    };
  }

  return {
    version: 1,
    totals: {
      rounds: stats.totals.rounds + 1,
      civilianWins: stats.totals.civilianWins + (result.winners.includes('civilians') ? 1 : 0),
      imposterWins: stats.totals.imposterWins + (result.winners.includes('imposters') ? 1 : 0),
      jesterWins: stats.totals.jesterWins + (result.winners.includes('jester') ? 1 : 0),
    },
    players,
    recordedRounds: [...stats.recordedRounds, round.id].slice(-RECORDED_ROUNDS_LIMIT),
  };
}

export function winRate(p: PlayerStats): number {
  return p.gamesPlayed === 0 ? 0 : Math.round((p.wins / p.gamesPlayed) * 100);
}

export const statsStore = createPersistentStore(STORAGE_KEYS.stats, sanitizeStats, emptyStats);
export const useStats = () => useStore(statsStore);
