import { BUILT_IN_CATEGORIES, WORD_BANK } from '../src/data/words';
import type { WordEntry } from '../src/data/words/types';
import {
  ABSTAIN,
  createInitialState,
  createRng,
  createRoundSetup,
  DEFAULT_GAME_CONFIG,
  eligibleTargets,
  gameReducer,
  getNextStep,
  seedFromNumber,
  type CategorySource,
  type GameAction,
  type GameConfig,
  type GameState,
  type Player,
  type Rng,
  type WordSource,
} from '../src/game';

export function builtInSource(extra: CategorySource[] = []): WordSource {
  return {
    categories: [
      ...BUILT_IN_CATEGORIES.map((c) => ({ id: c.id, name: c.id, custom: false, words: WORD_BANK[c.id] ?? [] })),
      ...extra,
    ],
  };
}

export function customCategory(id: string, words: string[]): CategorySource {
  return {
    id,
    name: id,
    custom: true,
    words: words.map((w): WordEntry => ({
      key: `${id}:${w}`,
      word: w,
      categoryId: id,
      difficulty: 'medium',
      related: [],
      tags: [],
    })),
  };
}

export function makePlayers(n: number, prefix = 'P'): Player[] {
  return Array.from({ length: n }, (_, i) => ({ id: `id${i}`, name: `${prefix}${i + 1}` }));
}

export function config(overrides: Partial<GameConfig> = {}): GameConfig {
  // Engine tests exercise the full on-phone flow (with voting) unless a test asks otherwise.
  return { ...DEFAULT_GAME_CONFIG, playStyle: 'full', voting: true, ...overrides };
}

/** Applies an action and asserts it was accepted (state changed). */
export function apply(state: GameState, action: GameAction): GameState {
  const next = gameReducer(state, action);
  if (next === state) throw new Error(`Action rejected in ${state.phase}: ${action.type}`);
  return next;
}

export function startGame(players: Player[], cfg: GameConfig, seed = 1, source = builtInSource()): GameState {
  const res = createRoundSetup(players, cfg, source, seedFromNumber(seed));
  if (!res.ok) throw new Error(`setup failed: ${res.errors.join(',')}`);
  return apply(createInitialState(cfg), {
    type: 'START_GAME',
    players,
    config: cfg,
    setup: res.setup,
    roundId: `r${seed}`,
    sessionId: `s${seed}`,
  });
}

/** Walks every player through the private reveal (ends in REVEAL_COMPLETE). */
export function revealAll(state: GameState): GameState {
  let s = apply(state, { type: 'BEGIN_REVEAL' });
  for (let i = 0; i < s.players.length; i++) {
    s = apply(s, { type: 'SHOW_SECRET', index: i });
    s = apply(s, { type: 'SECRET_SEEN', index: i });
  }
  expect(s.phase).toBe('REVEAL_COMPLETE');
  return s;
}

/**
 * Walks every player through the private reveal and the clue phase into discussion.
 * Words only with voting has no clue phase: it stops on REVEAL_COMPLETE, ready to vote.
 */
export function revealAndClue(state: GameState): GameState {
  let s = revealAll(state);
  if (s.config.playStyle === 'simple') return s;
  s = apply(s, { type: 'START_CLUES' });
  for (let i = 0; i < s.round!.clueOrder.length; i++) s = apply(s, { type: 'NEXT_CLUE', index: i });
  return apply(s, { type: 'START_DISCUSSION' });
}

/** A voter's pick(s): one player, ABSTAIN, or a list (a list is used as is). */
export type VoteStrategy = (voterId: string, targets: string[], state: GameState) => string | string[];

/** A strategy's answer as a full ballot of `picks` players: its own pick first, then seating order. */
function ballotFor(pick: string | string[], picks: number, targets: readonly string[]): string[] {
  if (Array.isArray(pick)) return pick;
  if (pick === ABSTAIN) return [];
  return [pick, ...targets.filter((t) => t !== pick)].slice(0, picks);
}

/** Every voter votes using `strategy` (a vote putting out `picks` players); returns state in VOTE_RESULT. */
export function voteAll(state: GameState, strategy: VoteStrategy, seed = 7, picks = 1): GameState {
  let s =
    state.phase === 'DISCUSSION' || state.phase === 'REVEAL_COMPLETE'
      ? apply(state, { type: 'START_VOTING', picks })
      : state;
  const voting = s.round!.voting!;
  for (const voterId of voting.voters) {
    const targets = eligibleTargets(s.round!.voting!, voterId);
    const targetIds = ballotFor(strategy(voterId, targets, s), s.round!.voting!.picks, targets);
    s = apply(s, { type: 'CAST_VOTE', voterId, targetIds });
  }
  return apply(s, { type: 'REVEAL_VOTES', seed: seedFromNumber(seed) });
}

export interface RoundOptions {
  /** How many players each vote puts out (default 1). */
  voteSize?: (s: GameState) => number;
  /** Players the group puts out loud instead of voting (null/[] = vote on the phone). */
  outLoud?: (s: GameState) => string[] | null;
}

export const randomVoter =
  (rng: Rng): VoteStrategy =>
  (_v, targets) =>
    targets[rng.int(targets.length)]!;

export const voteFor =
  (pickTarget: (s: GameState) => string | undefined): VoteStrategy =>
  (_v, targets, s) => {
    const t = pickTarget(s);
    return t !== undefined && targets.includes(t) ? t : targets[0]!;
  };

/**
 * Plays a whole round to ROUND_RESULT with the given vote strategy and guess behaviour.
 * Handles ties, revotes, eliminations, final guesses and multi-imposter hunts.
 */
export function playRoundToResult(
  state: GameState,
  strategy: VoteStrategy,
  guess: (s: GameState) => string,
  seed = 11,
  opts: RoundOptions = {},
): GameState {
  let s = revealAndClue(state);
  const rng = createRng(seedFromNumber(seed));
  for (let guard = 0; guard < 100; guard++) {
    if (s.phase === 'DISCUSSION' || s.phase === 'REVEAL_COMPLETE') {
      const loud = opts.outLoud?.(s);
      if (loud && loud.length > 0) s = apply(s, { type: 'VOTE_OUT_LOUD', playerIds: loud });
      else s = voteAll(s, strategy, rng.int(1e9), opts.voteSize?.(s) ?? 1);
    } else if (s.phase === 'VOTING') {
      s = voteAll(s, strategy, rng.int(1e9)); // a revote
    }
    if (s.phase === 'VOTE_RESULT') {
      if (s.round!.lastVote!.needsRevote) {
        s = apply(s, { type: 'START_REVOTE' });
        continue;
      }
      if (!s.round!.lastVote!.nobodyOut) s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    }
    if (s.phase === 'ELIMINATION' || s.phase === 'IMPOSTER_GUESS' || s.phase === 'VOTE_RESULT') {
      const step = getNextStep(s);
      if (step.kind === 'guess') {
        s = apply(s, { type: 'START_GUESS' });
        s = apply(s, { type: 'SUBMIT_GUESS', playerId: step.playerId, guess: guess(s) });
        continue;
      }
      if (step.kind === 'result') return apply(s, { type: 'FINISH_ROUND' });
      if (step.kind === 'continue') {
        s = apply(s, { type: 'CONTINUE_HUNT', to: rng.int(2) === 0 ? 'clues' : 'discussion' });
        if (s.phase === 'CLUE_PHASE') {
          for (let i = 0; i < s.round!.clueOrder.length; i++) s = apply(s, { type: 'NEXT_CLUE', index: i });
          s = apply(s, { type: 'START_DISCUSSION' });
        }
        // Words only: the hunt continues out loud, then the group votes again.
        if (s.phase === 'REVEAL_COMPLETE') s = apply(s, { type: 'START_VOTING' });
        continue;
      }
      throw new Error(`unexpected step ${step.kind}`);
    }
  }
  throw new Error('round did not finish');
}

export function rolesOf(state: GameState) {
  return state.round!.setup.roles;
}

export function idsWithRole(state: GameState, ...roles: string[]): string[] {
  const r = rolesOf(state);
  return Object.keys(r).filter((id) => roles.includes(r[id]!));
}
