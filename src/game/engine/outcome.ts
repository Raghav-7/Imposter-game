import { isHunted } from '../roles';
import type { GameState, PlayerId, ResultReason, RoundState, Team } from '../types';

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
 */
export function getNextStep(state: GameState): NextStep {
  const round = state.round;
  if (!round) return { kind: 'wait' };

  if (state.phase === 'ELIMINATION') {
    const last = round.eliminations[round.eliminations.length - 1];
    if (!last) return { kind: 'wait' };
    if (last.role === 'jester') return { kind: 'result', winners: ['jester', 'imposters'], reason: 'jesterVotedOut' };
    if (isHunted(last.role) && state.config.finalGuess && !round.guesses.some((g) => g.playerId === last.playerId)) {
      return { kind: 'guess', playerId: last.playerId };
    }
    return evaluateHunt(round);
  }

  if (state.phase === 'IMPOSTER_GUESS') {
    const guess = round.guesses.find((g) => g.playerId === round.pendingGuesser);
    if (!guess) return { kind: 'wait' };
    if (guess.correct) return { kind: 'result', winners: ['imposters'], reason: 'imposterGuessed' };
    return evaluateHunt(round);
  }

  return { kind: 'wait' };
}

export function huntedRemaining(round: RoundState): PlayerId[] {
  return round.alive.filter((id) => isHunted(round.setup.roles[id]!));
}

export function eliminationsLeft(round: RoundState): number {
  return Math.max(0, round.eliminationsAllowed - round.eliminations.length);
}

export function evaluateHunt(round: RoundState): NextStep {
  const remaining = huntedRemaining(round).length;
  if (remaining === 0) return { kind: 'result', winners: ['civilians'], reason: 'allCaught' };
  if (eliminationsLeft(round) < remaining) {
    return { kind: 'result', winners: ['imposters'], reason: 'imposterSurvived' };
  }
  return { kind: 'continue' };
}
