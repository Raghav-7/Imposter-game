import { BUILT_IN_CATEGORIES, WORD_BANK } from '../src/data/words';
import type { WordEntry } from '../src/data/words/types';
import {
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
  return { ...DEFAULT_GAME_CONFIG, ...overrides };
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

/** Walks every player through the private reveal and the clue phase into discussion. */
export function revealAndClue(state: GameState): GameState {
  let s = apply(state, { type: 'BEGIN_REVEAL' });
  for (let i = 0; i < s.players.length; i++) {
    s = apply(s, { type: 'SHOW_SECRET', index: i });
    s = apply(s, { type: 'SECRET_SEEN', index: i });
  }
  expect(s.phase).toBe('REVEAL_COMPLETE');
  s = apply(s, { type: 'START_CLUES' });
  for (let i = 0; i < s.round!.clueOrder.length; i++) s = apply(s, { type: 'NEXT_CLUE', index: i });
  return apply(s, { type: 'START_DISCUSSION' });
}

export type VoteStrategy = (voterId: string, targets: string[], state: GameState) => string;

/** Every voter votes using `strategy`; returns state in VOTE_RESULT. */
export function voteAll(state: GameState, strategy: VoteStrategy, seed = 7): GameState {
  let s = state.phase === 'DISCUSSION' ? apply(state, { type: 'START_VOTING' }) : state;
  const voting = s.round!.voting!;
  for (const voterId of voting.voters) {
    const targets = eligibleTargets(s.round!.voting!, voterId);
    s = apply(s, { type: 'CAST_VOTE', voterId, targetId: strategy(voterId, targets, s) });
  }
  return apply(s, { type: 'REVEAL_VOTES', seed: seedFromNumber(seed) });
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
): GameState {
  let s = revealAndClue(state);
  const rng = createRng(seedFromNumber(seed));
  for (let guard = 0; guard < 100; guard++) {
    if (s.phase === 'DISCUSSION' || s.phase === 'VOTING') s = voteAll(s, strategy, rng.int(1e9));
    if (s.phase === 'VOTE_RESULT') {
      if (s.round!.lastVote!.needsRevote) {
        s = apply(s, { type: 'START_REVOTE' });
        continue;
      }
      s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    }
    if (s.phase === 'ELIMINATION' || s.phase === 'IMPOSTER_GUESS') {
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
