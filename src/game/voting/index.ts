import { createRng, type Seed, shuffle } from '../engine/rng';
import type { PlayerId, Tally, TieRule, VoteOutcome, VotingState } from '../types';

/**
 * In a CAST_VOTE action, the target of an abstaining voter. Player ids are never empty, so it
 * can't clash. Inside VotingState an abstention is simply an empty list of picks.
 */
export const ABSTAIN = '';

/**
 * A secret vote among `alive` players. `picks` = how many players each voter names, which is
 * also how many players this vote puts out (several imposters can be voted out at once).
 * `alreadyOut` are players a tied vote already put out; they leave together with the revote's.
 */
export function startVoting(
  alive: readonly PlayerId[],
  candidates?: readonly PlayerId[],
  allowAbstain = false,
  picks = 1,
  alreadyOut: readonly PlayerId[] = [],
): VotingState {
  return {
    voters: alive.slice(),
    candidates: (candidates ?? alive).slice(),
    voterIndex: 0,
    votes: {},
    isRevote: candidates !== undefined,
    allowAbstain,
    picks,
    alreadyOut: alreadyOut.slice(),
  };
}

/** Who `voterId` may vote for: any candidate except themselves. */
export function eligibleTargets(voting: VotingState, voterId: PlayerId): PlayerId[] {
  return voting.candidates.filter((c) => c !== voterId);
}

/** Exactly `picks` different eligible players, or none at all when abstaining is allowed. */
export function isValidVote(voting: VotingState, voterId: PlayerId, targets: readonly PlayerId[]): boolean {
  if (voting.voters[voting.voterIndex] !== voterId || voting.votes[voterId] !== undefined) return false;
  if (targets.length === 0) return voting.allowAbstain === true;
  const eligible = eligibleTargets(voting, voterId);
  return (
    targets.length === voting.picks &&
    new Set(targets).size === targets.length &&
    targets.every((t) => eligible.includes(t))
  );
}

export function castVote(voting: VotingState, voterId: PlayerId, targets: readonly PlayerId[]): VotingState {
  if (!isValidVote(voting, voterId, targets)) return voting;
  return {
    ...voting,
    votes: { ...voting.votes, [voterId]: targets.slice() },
    voterIndex: voting.voterIndex + 1,
  };
}

export function allVotesIn(voting: VotingState): boolean {
  return voting.voterIndex >= voting.voters.length && voting.voters.every((v) => voting.votes[v] !== undefined);
}

export function tallyVotes(
  votes: Readonly<Record<PlayerId, readonly PlayerId[]>>,
  candidates: readonly PlayerId[],
): Tally {
  const counts: Record<PlayerId, number> = {};
  for (const c of candidates) counts[c] = 0;
  let abstained = 0;
  for (const picks of Object.values(votes)) {
    if (picks.length === 0) abstained += 1;
    for (const target of picks) if (counts[target] !== undefined) counts[target] += 1;
  }
  const maxVotes = Math.max(0, ...Object.values(counts));
  const leaders = candidates.filter((c) => counts[c] === maxVotes && maxVotes > 0);
  return { counts, leaders, maxVotes, isTie: leaders.length > 1, abstained };
}

/**
 * Resolves a completed vote that puts out `voting.picks` players:
 * - the players with the most votes are out (for one pick: the single leader);
 * - places nobody got a vote for (abstentions) stay empty and are used up — if nobody got a
 *   vote at all, nobody is out;
 * - a tie for the last place(s) triggers a revote among just the tied players for the places
 *   left (default), or a random pick among them. A tie on a revote is always broken at random,
 *   so the game can never loop forever. Nothing is ever decided by seating order.
 */
export function resolveVote(voting: VotingState, tieRule: TieRule, seed: Seed): VoteOutcome {
  const tally = tallyVotes(voting.votes, voting.candidates);
  const carried = voting.alreadyOut ?? [];
  const need = voting.picks ?? 1;
  const base: VoteOutcome = {
    tally,
    votes: { ...voting.votes },
    isRevote: voting.isRevote,
    eliminated: [],
    alreadyOut: carried.slice(),
    tied: [],
    needsRevote: false,
    revotePicks: 0,
    tieBrokenRandomly: false,
    unfilled: 0,
    nobodyOut: false,
  };
  const count = (id: PlayerId) => tally.counts[id] ?? 0;
  const withVotes = voting.candidates.filter((c) => count(c) > 0).sort((a, b) => count(b) - count(a));

  if (withVotes.length <= need) {
    const eliminated = [...carried, ...withVotes];
    return { ...base, eliminated, unfilled: need - withVotes.length, nobodyOut: eliminated.length === 0 };
  }
  const cutoff = count(withVotes[need - 1]!);
  const sure = withVotes.filter((c) => count(c) > cutoff);
  const tied = withVotes.filter((c) => count(c) === cutoff);
  const open = need - sure.length;
  if (tied.length === open) return { ...base, eliminated: [...carried, ...sure, ...tied] };
  if (tieRule === 'revote' && !voting.isRevote) {
    return { ...base, alreadyOut: [...carried, ...sure], tied, needsRevote: true, revotePicks: open };
  }
  const chosen = shuffle(createRng(seed), tied).slice(0, open);
  return { ...base, eliminated: [...carried, ...sure, ...chosen], tied, tieBrokenRandomly: true };
}
