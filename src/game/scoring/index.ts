import { isCivilianTeam, isHunted, roleTeam } from '../roles';
import type { PlayerId, ResultReason, RoundState, ScoreLine, ScoringConfig, Team } from '../types';

export const DEFAULT_SCORING: ScoringConfig = {
  enabled: true,
  civilianCorrectVote: 2,
  civilianWin: 1,
  imposterSurvive: 3,
  imposterGuess: 5,
  jesterVotedOut: 5,
};

export const SCORE_LIMITS = { min: 0, max: 10 } as const;

/**
 * Points for one finished round:
 * - Civilian team: +civilianCorrectVote for every decisive vote cast on a hidden player,
 *   +civilianWin each when civilians win.
 * - Hidden team: +imposterSurvive for each hidden player still in the game when they win,
 *   +imposterGuess for a correct final guess.
 * - Jester: +jesterVotedOut when voted out.
 */
export function scoreRound(
  round: RoundState,
  scoring: ScoringConfig,
  winners: readonly Team[],
  reason: ResultReason,
): { deltas: Record<PlayerId, number>; breakdown: ScoreLine[] } {
  const roles = round.setup.roles;
  const breakdown: ScoreLine[] = [];
  const add = (playerId: PlayerId, reasonKey: ScoreLine['reason'], points: number) => {
    if (points !== 0) breakdown.push({ playerId, reason: reasonKey, points });
  };

  if (scoring.enabled) {
    for (const elimination of round.eliminations) {
      for (const [voter, target] of Object.entries(elimination.votes)) {
        const voterRole = roles[voter];
        const targetRole = roles[target];
        if (voterRole && targetRole && isCivilianTeam(voterRole) && isHunted(targetRole)) {
          add(voter, 'correctVote', scoring.civilianCorrectVote);
        }
      }
    }
    if (winners.includes('civilians')) {
      for (const [id, role] of Object.entries(roles)) {
        if (roleTeam(role) === 'civilians') add(id, 'teamWin', scoring.civilianWin);
      }
    }
    if (winners.includes('imposters')) {
      for (const id of round.alive) {
        if (isHunted(roles[id]!)) add(id, 'survived', scoring.imposterSurvive);
      }
      if (reason === 'imposterGuessed') {
        const guess = round.guesses.find((g) => g.correct);
        if (guess) add(guess.playerId, 'guessedWord', scoring.imposterGuess);
      }
    }
    if (reason === 'jesterVotedOut') {
      const jester = round.eliminations.find((e) => e.role === 'jester');
      if (jester) add(jester.playerId, 'jesterOut', scoring.jesterVotedOut);
    }
  }

  const deltas: Record<PlayerId, number> = {};
  for (const id of Object.keys(roles)) deltas[id] = 0;
  for (const line of breakdown) deltas[line.playerId] = (deltas[line.playerId] ?? 0) + line.points;
  return { deltas, breakdown };
}

/** Did this player's team win? */
export function playerWon(round: RoundState, playerId: PlayerId, winners: readonly Team[]): boolean {
  const role = round.setup.roles[playerId];
  return role !== undefined && winners.includes(roleTeam(role));
}
