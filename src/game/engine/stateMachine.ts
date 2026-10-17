import type { Phase } from '../types';

/**
 * Allowed phase transitions. Anything not listed is rejected by the reducer,
 * so e.g. PLAYER_SETUP → VOTE_RESULT can never happen. Every in-game phase may
 * also exit to IDLE (leave / abandon game).
 */
export const TRANSITIONS: Readonly<Record<Phase, readonly Phase[]>> = {
  IDLE: ['PLAYER_SETUP', 'CONFIGURATION', 'WORD_GENERATED'],
  PLAYER_SETUP: ['CONFIGURATION', 'WORD_GENERATED', 'IDLE'],
  CONFIGURATION: ['PLAYER_SETUP', 'WORD_GENERATED', 'IDLE'],
  WORD_GENERATED: ['ROLE_REVEAL_INTRO', 'IDLE'],
  ROLE_REVEAL_INTRO: ['ROLE_REVEAL', 'IDLE'],
  // ROLE_REVEAL → ROLE_REVEAL_INTRO covers both "next player" and "hide again" (background/back).
  ROLE_REVEAL: ['ROLE_REVEAL_INTRO', 'REVEAL_COMPLETE', 'IDLE'],
  // Words-only style talks out loud on REVEAL_COMPLETE, then votes (voting on) or shows the answer.
  REVEAL_COMPLETE: ['CLUE_PHASE', 'ANSWER', 'VOTING', 'ELIMINATION', 'IDLE'],
  CLUE_PHASE: ['CLUE_PHASE', 'DISCUSSION', 'IDLE'],
  // Full game with voting off ends on the answer screen instead of a vote; ELIMINATION = decided
  // out loud (also from REVEAL_COMPLETE).
  DISCUSSION: ['VOTING', 'ANSWER', 'ELIMINATION', 'IDLE'],
  VOTING: ['VOTING', 'VOTE_RESULT', 'IDLE'],
  // A vote with nobody out (everyone abstained) goes straight to the result or the next hunt step.
  VOTE_RESULT: ['VOTING', 'ELIMINATION', 'ROUND_RESULT', 'CLUE_PHASE', 'DISCUSSION', 'REVEAL_COMPLETE', 'IDLE'],
  // REVEAL_COMPLETE = the words-only hunt continues out loud.
  ELIMINATION: ['IMPOSTER_GUESS', 'ROUND_RESULT', 'CLUE_PHASE', 'DISCUSSION', 'REVEAL_COMPLETE', 'IDLE'],
  IMPOSTER_GUESS: ['IMPOSTER_GUESS', 'ROUND_RESULT', 'CLUE_PHASE', 'DISCUSSION', 'REVEAL_COMPLETE', 'IDLE'],
  // Words only has no scoreboard: the next round starts from the result.
  ROUND_RESULT: ['SCOREBOARD', 'WORD_GENERATED', 'IDLE'],
  SCOREBOARD: ['WORD_GENERATED', 'GAME_COMPLETE', 'IDLE'],
  GAME_COMPLETE: ['IDLE', 'WORD_GENERATED'],
  ANSWER: ['WORD_GENERATED', 'IDLE'],
};

export function canTransition(from: Phase, to: Phase): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Phases that belong to an active game (used for back-button guards and resume). */
export const IN_GAME_PHASES: readonly Phase[] = [
  'WORD_GENERATED',
  'ROLE_REVEAL_INTRO',
  'ROLE_REVEAL',
  'REVEAL_COMPLETE',
  'CLUE_PHASE',
  'DISCUSSION',
  'VOTING',
  'VOTE_RESULT',
  'ELIMINATION',
  'IMPOSTER_GUESS',
  'ROUND_RESULT',
  'SCOREBOARD',
  'GAME_COMPLETE',
  'ANSWER',
];

export function isInGame(phase: Phase): boolean {
  return IN_GAME_PHASES.includes(phase);
}

/** Phases during which secret information may be on screen. */
export const SENSITIVE_PHASES: readonly Phase[] = ['ROLE_REVEAL', 'VOTING', 'IMPOSTER_GUESS'];

/**
 * When a saved game is restored, never land directly on a visible secret:
 * a revealed card goes back to the "pass the phone" gate for the same player.
 */
export function safeRestorePhase(phase: Phase): Phase {
  if (phase === 'ROLE_REVEAL') return 'ROLE_REVEAL_INTRO';
  return phase;
}
