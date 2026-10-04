import { isHunted } from '../roles';
import { scoreRound } from '../scoring';
import type { GameConfig, GameState, Phase, Player, PlayerId, RoundSetup, RoundState } from '../types';
import { allVotesIn, castVote, resolveVote, startVoting } from '../voting';
import { DEFAULT_GAME_CONFIG } from './config';
import { getNextStep } from './outcome';
import type { Seed } from './rng';
import { canTransition, safeRestorePhase } from './stateMachine';
import { cleanText, isGuessCorrect } from './text';
import { validatePlayers } from './validation';

export type GameAction =
  | { type: 'ENTER_SETUP' }
  | { type: 'ENTER_CONFIG' }
  | { type: 'BACK_TO_PLAYERS' }
  | {
      type: 'START_GAME';
      players: Player[];
      config: GameConfig;
      setup: RoundSetup;
      roundId: string;
      sessionId: string;
    }
  | { type: 'BEGIN_REVEAL' }
  | { type: 'SHOW_SECRET'; index: number }
  | { type: 'HIDE_SECRET' }
  | { type: 'SECRET_SEEN'; index: number }
  | { type: 'START_CLUES' }
  | { type: 'NEXT_CLUE'; index: number }
  | { type: 'ANOTHER_CLUE_ROUND' }
  | { type: 'START_DISCUSSION' }
  | { type: 'START_VOTING' }
  | { type: 'CAST_VOTE'; voterId: PlayerId; targetId: PlayerId }
  | { type: 'REVEAL_VOTES'; seed: Seed }
  | { type: 'START_REVOTE' }
  | { type: 'CONFIRM_ELIMINATION' }
  | { type: 'START_GUESS' }
  | { type: 'SUBMIT_GUESS'; playerId: PlayerId; guess: string }
  | { type: 'ACCEPT_GUESS'; playerId: PlayerId }
  | { type: 'CONTINUE_HUNT'; to: 'clues' | 'discussion' }
  | { type: 'FINISH_ROUND' }
  | { type: 'SHOW_SCOREBOARD' }
  | { type: 'NEXT_ROUND'; setup: RoundSetup; roundId: string }
  | { type: 'END_GAME' }
  | { type: 'EXIT_GAME' }
  | { type: 'RESTORE'; state: GameState }
  | { type: 'APP_BACKGROUNDED' }
  | { type: 'RECORD_PEEK'; playerId: PlayerId };

export const HISTORY_LIMIT = 30;

export function createInitialState(config: GameConfig = DEFAULT_GAME_CONFIG): GameState {
  return {
    phase: 'IDLE',
    sessionId: '',
    players: [],
    config,
    round: null,
    scores: {},
    roundsPlayed: 0,
    history: [],
  };
}

/** Moves to `to` if the state machine allows it; otherwise returns the state unchanged. */
function go(state: GameState, to: Phase, patch: Partial<GameState> = {}): GameState {
  if (!canTransition(state.phase, to)) return state;
  return { ...state, ...patch, phase: to };
}

function withRound(state: GameState, to: Phase, patch: Partial<RoundState>): GameState {
  if (!state.round) return state;
  return go(state, to, { round: { ...state.round, ...patch } });
}

export function createRoundState(
  id: string,
  number: number,
  players: readonly Player[],
  setup: RoundSetup,
): RoundState {
  const hunted = players.filter((p) => isHunted(setup.roles[p.id] ?? 'civilian')).length;
  return {
    id,
    number,
    setup,
    revealIndex: 0,
    clueOrder: setup.clueOrder.slice(),
    clueIndex: 0,
    clueRound: 1,
    alive: players.map((p) => p.id),
    eliminations: [],
    eliminationsAllowed: hunted,
    voting: null,
    lastVote: null,
    guesses: [],
    pendingGuesser: null,
    result: null,
    peeks: [],
  };
}

function setupMatchesPlayers(setup: RoundSetup, players: readonly Player[]): boolean {
  const ids = players.map((p) => p.id);
  const roleIds = Object.keys(setup.roles);
  return (
    roleIds.length === ids.length &&
    ids.every((id) => setup.roles[id] !== undefined) &&
    setup.clueOrder.length === ids.length &&
    ids.every((id) => setup.clueOrder.includes(id)) &&
    setup.word.word.trim().length > 0
  );
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const round = state.round;
  switch (action.type) {
    case 'ENTER_SETUP':
      return go(state, 'PLAYER_SETUP');
    case 'ENTER_CONFIG':
      return go(state, 'CONFIGURATION');
    case 'BACK_TO_PLAYERS':
      return go(state, 'PLAYER_SETUP');

    case 'START_GAME': {
      if (!['IDLE', 'PLAYER_SETUP', 'CONFIGURATION', 'GAME_COMPLETE'].includes(state.phase)) return state;
      if (validatePlayers(action.players).length > 0) return state;
      if (!setupMatchesPlayers(action.setup, action.players)) return state;
      const players = action.players.map((p) => ({ id: p.id, name: cleanText(p.name) }));
      const scores: Record<PlayerId, number> = {};
      for (const p of players) scores[p.id] = 0;
      return go(state, 'WORD_GENERATED', {
        sessionId: action.sessionId,
        players,
        config: action.config,
        round: createRoundState(action.roundId, 1, players, action.setup),
        scores,
        roundsPlayed: 0,
        history: [],
      });
    }

    case 'BEGIN_REVEAL':
      if (!round) return state;
      return withRound(state, 'ROLE_REVEAL_INTRO', { revealIndex: 0 });

    case 'SHOW_SECRET':
      if (!round || state.phase !== 'ROLE_REVEAL_INTRO' || action.index !== round.revealIndex) return state;
      return go(state, 'ROLE_REVEAL');

    case 'HIDE_SECRET':
    case 'APP_BACKGROUNDED':
      if (state.phase !== 'ROLE_REVEAL') return state;
      return go(state, 'ROLE_REVEAL_INTRO');

    case 'SECRET_SEEN': {
      if (!round || state.phase !== 'ROLE_REVEAL' || action.index !== round.revealIndex) return state;
      const next = round.revealIndex + 1;
      if (next >= state.players.length) return withRound(state, 'REVEAL_COMPLETE', { revealIndex: next });
      return withRound(state, 'ROLE_REVEAL_INTRO', { revealIndex: next });
    }

    case 'START_CLUES':
      if (state.phase !== 'REVEAL_COMPLETE' || !round) return state;
      return withRound(state, 'CLUE_PHASE', { clueIndex: 0, clueRound: 1 });

    case 'NEXT_CLUE':
      if (state.phase !== 'CLUE_PHASE' || !round || action.index !== round.clueIndex) return state;
      if (round.clueIndex >= round.clueOrder.length) return state;
      return withRound(state, 'CLUE_PHASE', { clueIndex: round.clueIndex + 1 });

    case 'ANOTHER_CLUE_ROUND':
      if (state.phase !== 'CLUE_PHASE' || !round || round.clueIndex < round.clueOrder.length) return state;
      return withRound(state, 'CLUE_PHASE', { clueIndex: 0, clueRound: round.clueRound + 1 });

    case 'START_DISCUSSION':
      if (state.phase !== 'CLUE_PHASE' || !round) return state;
      return go(state, 'DISCUSSION');

    case 'START_VOTING':
      if (state.phase !== 'DISCUSSION' || !round) return state;
      return withRound(state, 'VOTING', { voting: startVoting(round.alive), lastVote: null });

    case 'CAST_VOTE': {
      if (state.phase !== 'VOTING' || !round?.voting) return state;
      const voting = castVote(round.voting, action.voterId, action.targetId);
      if (voting === round.voting) return state;
      return withRound(state, 'VOTING', { voting });
    }

    case 'REVEAL_VOTES': {
      if (state.phase !== 'VOTING' || !round?.voting || !allVotesIn(round.voting)) return state;
      const outcome = resolveVote(round.voting, state.config.tieRule, action.seed);
      return withRound(state, 'VOTE_RESULT', { lastVote: outcome });
    }

    case 'START_REVOTE': {
      if (state.phase !== 'VOTE_RESULT' || !round?.lastVote?.needsRevote) return state;
      const voting = startVoting(round.alive, round.lastVote.tally.leaders);
      return withRound(state, 'VOTING', { voting: { ...voting, isRevote: true }, lastVote: null });
    }

    case 'CONFIRM_ELIMINATION': {
      const outcome = round?.lastVote;
      if (state.phase !== 'VOTE_RESULT' || !round || !outcome?.eliminated) return state;
      const eliminated = outcome.eliminated;
      if (!round.alive.includes(eliminated)) return state;
      return withRound(state, 'ELIMINATION', {
        alive: round.alive.filter((id) => id !== eliminated),
        eliminations: [
          ...round.eliminations,
          {
            playerId: eliminated,
            role: round.setup.roles[eliminated] ?? 'civilian',
            votes: outcome.votes,
            tieBrokenRandomly: outcome.tieBrokenRandomly,
          },
        ],
        voting: null,
      });
    }

    case 'START_GUESS': {
      const step = getNextStep(state);
      if (state.phase !== 'ELIMINATION' || step.kind !== 'guess') return state;
      return withRound(state, 'IMPOSTER_GUESS', { pendingGuesser: step.playerId });
    }

    case 'SUBMIT_GUESS': {
      if (state.phase !== 'IMPOSTER_GUESS' || !round || round.pendingGuesser !== action.playerId) return state;
      if (round.guesses.some((g) => g.playerId === action.playerId)) return state;
      const guess = cleanText(action.guess);
      if (guess.length === 0) return state;
      const correct = isGuessCorrect(guess, round.setup.word.word);
      return withRound(state, 'IMPOSTER_GUESS', {
        guesses: [...round.guesses, { playerId: action.playerId, guess, correct, acceptedByGroup: false }],
      });
    }

    case 'ACCEPT_GUESS': {
      if (state.phase !== 'IMPOSTER_GUESS' || !round) return state;
      const existing = round.guesses.find((g) => g.playerId === action.playerId);
      if (!existing || existing.correct) return state;
      return withRound(state, 'IMPOSTER_GUESS', {
        guesses: round.guesses.map((g) =>
          g.playerId === action.playerId ? { ...g, correct: true, acceptedByGroup: true } : g,
        ),
      });
    }

    case 'CONTINUE_HUNT': {
      if (!round || getNextStep(state).kind !== 'continue') return state;
      const clueOrder = round.clueOrder.filter((id) => round.alive.includes(id));
      const patch: Partial<RoundState> = { pendingGuesser: null, lastVote: null, voting: null, clueOrder };
      if (action.to === 'clues') {
        return withRound(state, 'CLUE_PHASE', { ...patch, clueIndex: 0, clueRound: round.clueRound + 1 });
      }
      return withRound(state, 'DISCUSSION', patch);
    }

    case 'FINISH_ROUND': {
      const step = getNextStep(state);
      if (!round || step.kind !== 'result') return state;
      const { deltas, breakdown } = scoreRound(round, state.config.scoring, step.winners, step.reason);
      const scores = { ...state.scores };
      for (const [id, pts] of Object.entries(deltas)) scores[id] = (scores[id] ?? 0) + pts;
      const summary = {
        number: round.number,
        word: round.setup.word.word,
        altWord: round.setup.altWord,
        categoryName: round.setup.word.categoryName,
        winners: step.winners,
        reason: step.reason,
      };
      return go(state, 'ROUND_RESULT', {
        round: {
          ...round,
          pendingGuesser: null,
          result: { winners: step.winners, reason: step.reason, scoreDeltas: deltas, breakdown },
        },
        scores,
        roundsPlayed: state.roundsPlayed + 1,
        history: [...state.history, summary].slice(-HISTORY_LIMIT),
      });
    }

    case 'SHOW_SCOREBOARD':
      if (!round?.result) return state;
      return go(state, 'SCOREBOARD');

    case 'NEXT_ROUND': {
      if (state.phase !== 'SCOREBOARD' || !round) return state;
      if (!setupMatchesPlayers(action.setup, state.players)) return state;
      return go(state, 'WORD_GENERATED', {
        round: createRoundState(action.roundId, round.number + 1, state.players, action.setup),
      });
    }

    case 'END_GAME':
      if (state.phase !== 'SCOREBOARD') return state;
      // Drop the finished round's secrets; only the public summary stays.
      return go(state, 'GAME_COMPLETE', { round: null });

    case 'EXIT_GAME':
      return { ...createInitialState(state.config) };

    case 'RESTORE':
      if (state.phase !== 'IDLE') return state;
      return { ...action.state, phase: safeRestorePhase(action.state.phase) };

    case 'RECORD_PEEK': {
      if (!round || (state.phase !== 'CLUE_PHASE' && state.phase !== 'DISCUSSION')) return state;
      if (!round.alive.includes(action.playerId)) return state;
      return { ...state, round: { ...round, peeks: [...round.peeks, action.playerId] } };
    }

    default:
      return state;
  }
}
