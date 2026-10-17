import { isHunted } from '../roles';
import type { Elimination, GameState, PlayerId, ResultReason, RoundState, Team } from '../types';

export type NextStep =
  | { kind: 'guess'; playerId: PlayerId }
  | { kind: 'result'; winners: Team[]; reason: ResultReason }
  | { kind: 'continue' }
  | { kind: 'wait' };

/**
 * Win rules (documented on the Rules screen):
 * - Each vote eliminates one player. Civilians get as many votes as there are
 *   hidden players (imposters + undercovers).
 * - Voting out the Jester ends the round: the Jester wins, and the hidden team
 *   (still at large) wins too.
 * - An eliminated imposter/undercover may guess the civilians' word; a correct
 *   guess wins the round for their whole team.
 * - Civilians win once every hidden player is eliminated with no correct guess.
 * - If the remaining votes can no longer catch every hidden player, the hidden
 *   team wins.
 * - A vote where everyone abstains puts nobody out but still uses up that vote.
 * - A vote may put out several players at once (one place per hidden player it hunts for);
 *   each caught imposter then gets their own final guess, one after another.
 */
export function getNextStep(state: GameState): NextStep {
  const round = state.round;
  if (!round) return { kind: 'wait' };

  if (state.phase === 'VOTE_RESULT') {
    return round.lastVote?.nobodyOut ? evaluateHunt(round) : { kind: 'wait' };
  }

  if (state.phase === 'ELIMINATION' || state.phase === 'IMPOSTER_GUESS') {
    const batch = lastBatch(round);
    if (batch.length === 0) return { kind: 'wait' };
    if (state.phase === 'IMPOSTER_GUESS') {
      const guess = round.guesses.find((g) => g.playerId === round.pendingGuesser);
      if (!guess) return { kind: 'wait' };
      if (guess.correct) return { kind: 'result', winners: ['imposters'], reason: 'imposterGuessed' };
    } else if (batch.some((e) => e.role === 'jester')) {
      return { kind: 'result', winners: ['jester', 'imposters'], reason: 'jesterVotedOut' };
    }
    const guesser = state.config.finalGuess
      ? batch.find((e) => isHunted(e.role) && !round.guesses.some((g) => g.playerId === e.playerId))
      : undefined;
    if (guesser) return { kind: 'guess', playerId: guesser.playerId };
    return evaluateHunt(round);
  }

  return { kind: 'wait' };
}

/** Players put out by the most recent vote (or out-loud decision). */
export function lastBatch(round: RoundState): Elimination[] {
  const last = round.eliminations[round.eliminations.length - 1];
  return last ? round.eliminations.filter((e) => e.vote === last.vote) : [];
}

/** How many players the next vote may put out: one place per hidden player still at large. */
export function maxVoteOut(round: RoundState): number {
  return Math.max(1, Math.min(huntedRemaining(round).length, eliminationsLeft(round), round.alive.length - 1));
}

export function huntedRemaining(round: RoundState): PlayerId[] {
  return round.alive.filter((id) => isHunted(round.setup.roles[id]!));
}

export function eliminationsLeft(round: RoundState): number {
  return Math.max(0, round.eliminationsAllowed - round.eliminations.length - (round.skippedVotes ?? 0));
}

export function evaluateHunt(round: RoundState): NextStep {
  const remaining = huntedRemaining(round).length;
  if (remaining === 0) return { kind: 'result', winners: ['civilians'], reason: 'allCaught' };
  if (eliminationsLeft(round) < remaining) {
    return { kind: 'result', winners: ['imposters'], reason: 'imposterSurvived' };
  }
  return { kind: 'continue' };
}
