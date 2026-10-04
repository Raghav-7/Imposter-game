import { DIFFICULTIES } from '../../data/words/types';
import { MAX_IMPOSTERS, MODE_ORDER } from '../modes';
import { DEFAULT_SCORING, SCORE_LIMITS } from '../scoring';
import type { ClueTimer, DiscussionTimer, GameConfig, ScoringConfig } from '../types';

export const CLUE_TIMER_OPTIONS: readonly ClueTimer[] = [0, 15, 30, 45, 60];
export const DISCUSSION_TIMER_OPTIONS: readonly DiscussionTimer[] = [30, 60, 90, 120, 0];

export const DEFAULT_GAME_CONFIG: GameConfig = {
  mode: 'classic',
  imposterCount: 1,
  categoryId: 'random',
  excludedCategories: [],
  customInRandom: true,
  difficulty: 'medium',
  clueTimerSec: 0,
  discussionTimerSec: 90,
  tieRule: 'revote',
  guessStyle: 'choice',
  finalGuess: true,
  impostersSeeTeammates: true,
  undercoverAware: false,
  roles: { detective: false, jester: false },
  chaosModifierCount: 2,
  scoring: DEFAULT_SCORING,
  playStyle: 'simple',
};

/** Quick Play: zero-config sensible game. */
export const QUICK_PLAY_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  categoryId: 'random',
  difficulty: 'medium',
  discussionTimerSec: 60,
};

export const QUICK_PLAY_PLAYER_COUNT = 5;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function sanitizeScoring(raw: unknown): ScoringConfig {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_SCORING;
  const pts = (v: unknown, f: number) => intIn(v, SCORE_LIMITS.min, SCORE_LIMITS.max, f);
  return {
    enabled: bool(r.enabled, d.enabled),
    civilianCorrectVote: pts(r.civilianCorrectVote, d.civilianCorrectVote),
    civilianWin: pts(r.civilianWin, d.civilianWin),
    imposterSurvive: pts(r.imposterSurvive, d.imposterSurvive),
    imposterGuess: pts(r.imposterGuess, d.imposterGuess),
    jesterVotedOut: pts(r.jesterVotedOut, d.jesterVotedOut),
  };
}

/** Coerce untrusted (persisted) data into a valid config, field by field. */
export function sanitizeConfig(raw: unknown): GameConfig {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_GAME_CONFIG;
  const roles = isRecord(r.roles) ? r.roles : {};
  return {
    mode: oneOf(r.mode, MODE_ORDER, d.mode),
    imposterCount: intIn(r.imposterCount, 1, MAX_IMPOSTERS, d.imposterCount),
    categoryId: typeof r.categoryId === 'string' && r.categoryId.length > 0 ? r.categoryId : d.categoryId,
    excludedCategories: Array.isArray(r.excludedCategories)
      ? [...new Set(r.excludedCategories.filter((x): x is string => typeof x === 'string'))]
      : d.excludedCategories,
    customInRandom: bool(r.customInRandom, d.customInRandom),
    difficulty: oneOf(r.difficulty, DIFFICULTIES, d.difficulty),
    clueTimerSec: oneOf(r.clueTimerSec, CLUE_TIMER_OPTIONS, d.clueTimerSec),
    discussionTimerSec: oneOf(r.discussionTimerSec, DISCUSSION_TIMER_OPTIONS, d.discussionTimerSec),
    tieRule: oneOf(r.tieRule, ['revote', 'random'] as const, d.tieRule),
    guessStyle: oneOf(r.guessStyle, ['choice', 'type'] as const, d.guessStyle),
    finalGuess: bool(r.finalGuess, d.finalGuess),
    impostersSeeTeammates: bool(r.impostersSeeTeammates, d.impostersSeeTeammates),
    undercoverAware: bool(r.undercoverAware, d.undercoverAware),
    roles: { detective: bool(roles.detective, false), jester: bool(roles.jester, false) },
    chaosModifierCount: oneOf(r.chaosModifierCount, [1, 2] as const, d.chaosModifierCount),
    scoring: sanitizeScoring(r.scoring),
    playStyle: oneOf(r.playStyle, ['simple', 'full'] as const, d.playStyle),
  };
}
