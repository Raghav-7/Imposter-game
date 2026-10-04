import { createRng, type Seed } from '../engine/rng';
import type { PlayerId, Tally, TieRule, VoteOutcome, VotingState } from '../types';

export function startVoting(alive: readonly PlayerId[], candidates?: readonly PlayerId[]): VotingState {
  return {
    voters: alive.slice(),
    candidates: (candidates ?? alive).slice(),
    voterIndex: 0,
    votes: {},
    isRevote: candidates !== undefined,
  };
}

/** Who `voterId` may vote for: any candidate except themselves. */
export function eligibleTargets(voting: VotingState, voterId: PlayerId): PlayerId[] {
  return voting.candidates.filter((c) => c !== voterId);
}

export function isValidVote(voting: VotingState, voterId: PlayerId, targetId: PlayerId): boolean {
  return (
    voting.voters[voting.voterIndex] === voterId &&
    voting.votes[voterId] === undefined &&
    eligibleTargets(voting, voterId).includes(targetId)
  );
}

export function castVote(voting: VotingState, voterId: PlayerId, targetId: PlayerId): VotingState {
  if (!isValidVote(voting, voterId, targetId)) return voting;
  return {
    ...voting,
    votes: { ...voting.votes, [voterId]: targetId },
    voterIndex: voting.voterIndex + 1,
  };
}

export function allVotesIn(voting: VotingState): boolean {
  return voting.voterIndex >= voting.voters.length && voting.voters.every((v) => voting.votes[v] !== undefined);
}

export function tallyVotes(votes: Readonly<Record<PlayerId, PlayerId>>, candidates: readonly PlayerId[]): Tally {
  const counts: Record<PlayerId, number> = {};
  for (const c of candidates) counts[c] = 0;
  for (const target of Object.values(votes)) {
    if (counts[target] !== undefined) counts[target] += 1;
  }
  const maxVotes = Math.max(0, ...Object.values(counts));
  const leaders = candidates.filter((c) => counts[c] === maxVotes && maxVotes > 0);
  return { counts, leaders, maxVotes, isTie: leaders.length > 1 };
}

/**
 * Resolves a completed vote. Ties trigger a revote among the tied players
 * (default) or a random elimination. A tie on a revote is always broken randomly
 * so the game can never loop forever.
 */
export function resolveVote(voting: VotingState, tieRule: TieRule, seed: Seed): VoteOutcome {
  const tally = tallyVotes(voting.votes, voting.candidates);
  const base = { tally, votes: { ...voting.votes }, isRevote: voting.isRevote };
  if (tally.leaders.length === 1) {
    return { ...base, eliminated: tally.leaders[0]!, needsRevote: false, tieBrokenRandomly: false };
  }
  const tied = tally.leaders.length > 0 ? tally.leaders : voting.candidates.slice();
  if (tieRule === 'revote' && !voting.isRevote) {
    return { ...base, eliminated: null, needsRevote: true, tieBrokenRandomly: false };
  }
  const rng = createRng(seed);
  return {
    ...base,
    eliminated: tied[rng.int(tied.length)]!,
    needsRevote: false,
    tieBrokenRandomly: true,
  };
}
