import {
  ABSTAIN,
  castVote,
  createRoundSetup,
  eligibleTargets,
  eliminationsLeft,
  gameReducer,
  getNextStep,
  getSecretView,
  lastBatch,
  maxVoteOut,
  resolveVote,
  sanitizeConfig,
  seedFromNumber,
  startVoting,
  tallyVotes,
  type GameConfig,
  type GameState,
  type PlayerId,
} from '../../src/game';
import { decodeSave, encodeSave, validateGameState } from '../../src/game/engine/persist';
import {
  apply,
  builtInSource,
  config,
  idsWithRole,
  makePlayers,
  playRoundToResult,
  revealAll,
  revealAndClue,
  startGame,
  voteAll,
  voteFor,
} from '../helpers';

const hidden = (s: GameState) =>
  s.round!.alive.filter((id) => ['imposter', 'undercover'].includes(s.round!.setup.roles[id]!));
const civilian = (s: GameState) => s.round!.alive.find((id) => s.round!.setup.roles[id] === 'civilian');
const secret = (s: GameState) => s.round!.setup.word.word;
/** Words only with on-phone voting. */
const wordsVoting = (o: Partial<GameConfig> = {}) => config({ playStyle: 'simple', voting: true, ...o });

/** Casts `plan[voter]` for every voter (ABSTAIN allowed), then reveals. */
function votePlan(s: GameState, plan: (voter: PlayerId, targets: PlayerId[]) => PlayerId, seed = 5): GameState {
  let st = s.phase === 'VOTING' ? s : apply(s, { type: 'START_VOTING' });
  for (const voter of st.round!.voting!.voters) {
    st = apply(st, {
      type: 'CAST_VOTE',
      voterId: voter,
      targetId: plan(voter, eligibleTargets(st.round!.voting!, voter)),
    });
  }
  return apply(st, { type: 'REVEAL_VOTES', seed: seedFromNumber(seed) });
}

describe('voting setting', () => {
  it('defaults: new games vote out loud; Full game configs saved before the switch keep voting', () => {
    expect(sanitizeConfig({}).voting).toBe(false);
    expect(sanitizeConfig({ playStyle: 'simple' }).voting).toBe(false);
    expect(sanitizeConfig({ playStyle: 'full' }).voting).toBe(true);
    expect(sanitizeConfig({ playStyle: 'full', voting: false }).voting).toBe(false);
    expect(sanitizeConfig({ playStyle: 'simple', voting: true }).voting).toBe(true);
    expect(sanitizeConfig({ allowAbstain: 'yes' }).allowAbstain).toBe(false);
  });

  it('voting off (Words only): no voting screens at all, the answer comes straight after talking', () => {
    const s = revealAll(startGame(makePlayers(5), config({ playStyle: 'simple', voting: false })));
    expect(gameReducer(s, { type: 'START_VOTING' })).toBe(s);
    expect(apply(s, { type: 'REVEAL_ANSWER' }).phase).toBe('ANSWER');
  });

  it('voting off (Full game): clues and discussion, then the answer instead of a vote', () => {
    let s = revealAndClue(startGame(makePlayers(5), config({ voting: false })));
    expect(s.phase).toBe('DISCUSSION');
    expect(gameReducer(s, { type: 'START_VOTING' })).toBe(s);
    s = apply(s, { type: 'REVEAL_ANSWER' });
    expect(s.phase).toBe('ANSWER');
    expect(Object.values(s.scores).every((v) => v === 0)).toBe(true);
    const res = createRoundSetup(s.players, s.config, builtInSource(), seedFromNumber(9));
    if (!res.ok) throw new Error(res.errors.join());
    expect(apply(s, { type: 'NEXT_ROUND', setup: res.setup, roundId: 'r2' }).phase).toBe('WORD_GENERATED');
  });

  it('voting on: the answer screen cannot be used to skip the vote', () => {
    const words = revealAll(startGame(makePlayers(5), wordsVoting()));
    expect(gameReducer(words, { type: 'REVEAL_ANSWER' })).toBe(words);
    const full = revealAndClue(startGame(makePlayers(5), config()));
    expect(gameReducer(full, { type: 'REVEAL_ANSWER' })).toBe(full);
  });
});

describe('words only + voting', () => {
  it('3 players / 1 imposter: vote after talking, imposter caught, wrong guess → civilians win', () => {
    let s = revealAll(startGame(makePlayers(3), wordsVoting()));
    s = apply(s, { type: 'START_VOTING' });
    expect(s.phase).toBe('VOTING');
    expect(s.round!.lastVote).toBeNull(); // nothing to read before the results
    const imp = hidden(s)[0]!;
    s = votePlan(s, (voter, targets) => (targets.includes(imp) ? imp : targets[0]!));
    expect(s.round!.lastVote!.eliminated).toEqual([imp]);
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    expect(getNextStep(s)).toEqual({ kind: 'guess', playerId: imp });
    s = apply(s, { type: 'START_GUESS' });
    s = apply(s, { type: 'SUBMIT_GUESS', playerId: imp, guess: 'not it' });
    s = apply(s, { type: 'FINISH_ROUND' });
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.round!.result!.winners).toEqual(['civilians']);
  });

  it('keeps no points, and the next round starts from the result (no scoreboard)', () => {
    let s = playRoundToResult(
      startGame(makePlayers(5), wordsVoting()),
      voteFor((st) => hidden(st)[0]),
      () => 'x',
    );
    expect(s.round!.result!.winners).toEqual(['civilians']);
    expect(Object.values(s.round!.result!.scoreDeltas).every((v) => v === 0)).toBe(true);
    expect(Object.values(s.scores).every((v) => v === 0)).toBe(true);
    const res = createRoundSetup(s.players, s.config, builtInSource(), seedFromNumber(31));
    if (!res.ok) throw new Error(res.errors.join());
    const prev = s.round!;
    s = apply(s, { type: 'NEXT_ROUND', setup: res.setup, roundId: 'r2' });
    expect(s.phase).toBe('WORD_GENERATED');
    expect(s.round).not.toBe(prev);
    expect(s.round!.eliminations).toEqual([]);
    expect(s.round!.voting).toBeNull();
    expect(s.round!.lastVote).toBeNull();
  });

  it('the Full game still goes through the scoreboard', () => {
    const s = playRoundToResult(
      startGame(makePlayers(5), config()),
      voteFor((st) => hidden(st)[0]),
      () => 'x',
    );
    const res = createRoundSetup(s.players, s.config, builtInSource(), seedFromNumber(31));
    if (!res.ok) throw new Error(res.errors.join());
    expect(gameReducer(s, { type: 'NEXT_ROUND', setup: res.setup, roundId: 'r2' })).toBe(s);
  });

  it('multiple imposters: catching one is not a win; the hunt goes back to talking out loud', () => {
    let s = revealAll(startGame(makePlayers(7), wordsVoting({ imposterCount: 2, finalGuess: false })));
    const [first, second] = hidden(s) as [string, string];
    s = votePlan(s, (_v, t) => (t.includes(first) ? first : t[0]!));
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    expect(getNextStep(s)).toEqual({ kind: 'continue' });
    expect(gameReducer(s, { type: 'FINISH_ROUND' })).toBe(s);
    s = apply(s, { type: 'CONTINUE_HUNT', to: 'discussion' });
    expect(s.phase).toBe('REVEAL_COMPLETE');
    expect(s.round!.clueOrder).not.toContain(first);
    // Peeking at your word is still allowed while talking.
    expect(apply(s, { type: 'RECORD_PEEK', playerId: s.round!.alive[0]! }).round!.peeks).toHaveLength(1);
    s = votePlan(s, (_v, t) => (t.includes(second) ? second : t[0]!));
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    s = apply(s, { type: 'FINISH_ROUND' });
    expect(s.round!.result).toMatchObject({ winners: ['civilians'], reason: 'allCaught' });
  });

  it('results stay correct over several rounds', () => {
    let s = startGame(makePlayers(6), wordsVoting());
    for (let r = 0; r < 4; r++) {
      const catchThem = r % 2 === 0;
      s = playRoundToResult(s, voteFor(catchThem ? (st) => hidden(st)[0] : civilian), () => 'nope');
      expect(s.round!.result!.winners).toEqual(catchThem ? ['civilians'] : ['imposters']);
      expect(s.roundsPlayed).toBe(r + 1);
      const res = createRoundSetup(s.players, s.config, builtInSource(), seedFromNumber(200 + r));
      if (!res.ok) throw new Error(res.errors.join());
      if (r < 3) s = apply(s, { type: 'NEXT_ROUND', setup: res.setup, roundId: `n${r}` });
    }
    expect(s.history.map((h) => h.winners[0])).toEqual(['civilians', 'imposters', 'civilians', 'imposters']);
  });
});

describe('vote results follow the real win rules', () => {
  it('5 players / 1 imposter: a civilian with the most votes → imposter survives', () => {
    let s = revealAndClue(startGame(makePlayers(5), config()));
    const victim = civilian(s)!;
    s = votePlan(s, (voter, t) => (t.includes(victim) ? victim : t[0]!));
    expect(s.round!.lastVote!.eliminated).toEqual([victim]);
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    expect(s.round!.eliminations[0]!.role).toBe('civilian');
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['imposters'], reason: 'imposterSurvived' });
  });

  it('imposter with the most votes, then guesses the word → imposters win', () => {
    const s = playRoundToResult(
      startGame(makePlayers(5), config()),
      voteFor((st) => hidden(st)[0]),
      secret,
    );
    expect(s.round!.eliminations[0]!.role).toBe('imposter');
    expect(s.round!.result).toMatchObject({ winners: ['imposters'], reason: 'imposterGuessed' });
  });

  it('a detective voted out is just a wrong vote; their intel is untouched by voting', () => {
    let s = startGame(makePlayers(5), config({ roles: { detective: true, jester: false } }));
    const det = idsWithRole(s, 'detective')[0]!;
    const intel = s.round!.setup.intel[det];
    s = revealAndClue(s);
    s = votePlan(s, (_v, t) => (t.includes(det) ? det : t[0]!));
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    expect(s.round!.eliminations[0]!.role).toBe('detective');
    expect(getNextStep(s)).toMatchObject({ kind: 'result', winners: ['imposters'] });
    expect(s.round!.setup.intel[det]).toEqual(intel);
  });

  it('jester voted out: round ends, jester and imposters win (also in Words only)', () => {
    for (const cfg of [
      config({ roles: { jester: true, detective: false } }),
      wordsVoting({ roles: { jester: true, detective: false } }),
    ]) {
      const s = playRoundToResult(
        startGame(makePlayers(6), cfg),
        voteFor((st) => idsWithRole(st, 'jester')[0]),
        () => 'x',
      );
      expect(s.round!.result).toMatchObject({ winners: ['jester', 'imposters'], reason: 'jesterVotedOut' });
    }
  });
});

describe('ties', () => {
  it('two-way tie: revote only between the tied players', () => {
    let s = revealAndClue(startGame(makePlayers(4), config()));
    const [a, b, c, d] = s.round!.alive as [string, string, string, string];
    const plan: Record<string, string> = { [a]: b, [b]: a, [c]: a, [d]: b };
    s = votePlan(s, (v) => plan[v]!);
    expect(s.round!.lastVote).toMatchObject({ needsRevote: true, eliminated: [] });
    expect(s.round!.lastVote!.tally.leaders.sort()).toEqual([a, b].sort());
    s = apply(s, { type: 'START_REVOTE' });
    expect(s.round!.voting!.candidates.sort()).toEqual([a, b].sort());
    expect(s.round!.voting!.isRevote).toBe(true);
    expect(gameReducer(s, { type: 'CAST_VOTE', voterId: s.round!.voting!.voters[0]!, targetId: c })).toBe(s);
  });

  it('three-way tie: revote among exactly those three', () => {
    let s = revealAndClue(startGame(makePlayers(6), config()));
    const [a, b, c, d, e, f] = s.round!.alive as [string, string, string, string, string, string];
    const plan: Record<string, string> = { [a]: b, [b]: c, [c]: a, [d]: a, [e]: b, [f]: c };
    s = votePlan(s, (v) => plan[v]!);
    expect(s.round!.lastVote!.tally.leaders.sort()).toEqual([a, b, c].sort());
    expect(s.round!.lastVote!.needsRevote).toBe(true);
    s = apply(s, { type: 'START_REVOTE' });
    expect(s.round!.voting!.candidates.sort()).toEqual([a, b, c].sort());
  });

  it('a tied revote is broken at random, only among the tied players, so voting always ends', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      let s = revealAndClue(startGame(makePlayers(4), config()));
      const [a, b, c, d] = s.round!.alive as [string, string, string, string];
      const plan: Record<string, string> = { [a]: b, [b]: a, [c]: a, [d]: b };
      s = votePlan(s, (v) => plan[v]!, seed);
      s = apply(s, { type: 'START_REVOTE' });
      s = votePlan(s, (v) => plan[v]!, seed);
      expect(s.round!.lastVote!.tieBrokenRandomly).toBe(true);
      expect(s.round!.lastVote!.eliminated).toHaveLength(1);
      expect([a, b]).toContain(s.round!.lastVote!.eliminated[0]);
      outcomes.add(s.round!.lastVote!.eliminated[0] === a ? 'a' : 'b');
      expect(gameReducer(s, { type: 'START_REVOTE' })).toBe(s); // no third vote
    }
    expect(outcomes).toEqual(new Set(['a', 'b'])); // not decided by array order
  });

  it('random tie rule never picks a player outside the tie', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const voting = startVoting(['a', 'b', 'c', 'd']);
      const v = { ...voting, votes: { a: ['b'], b: ['a'], c: ['a'], d: ['b'] }, voterIndex: 4 };
      const out = resolveVote(v, 'random', seedFromNumber(seed));
      expect(out.eliminated).toHaveLength(1);
      expect(['a', 'b']).toContain(out.eliminated[0]);
      expect(out.tieBrokenRandomly).toBe(true);
    }
  });
});

describe('abstaining', () => {
  it('is rejected unless the option is on', () => {
    const off = startVoting(['a', 'b', 'c']);
    expect(castVote(off, 'a', [])).toBe(off);
    const on = startVoting(['a', 'b', 'c'], undefined, true);
    expect(castVote(on, 'a', []).votes).toEqual({ a: [] });
  });

  it('abstentions are counted separately and never as a vote for anyone', () => {
    const tally = tallyVotes({ a: ['b'], b: [], c: ['b'], d: [] }, ['a', 'b', 'c', 'd']);
    expect(tally).toMatchObject({ leaders: ['b'], maxVotes: 2, abstained: 2, isTie: false });
    expect(tally.counts).toEqual({ a: 0, b: 2, c: 0, d: 0 });
  });

  it('the config switch reaches the ballot, including revotes', () => {
    let s = revealAndClue(startGame(makePlayers(4), config({ allowAbstain: true })));
    s = apply(s, { type: 'START_VOTING' });
    expect(s.round!.voting!.allowAbstain).toBe(true);
    const off = apply(revealAndClue(startGame(makePlayers(4), config())), { type: 'START_VOTING' });
    const voter = off.round!.voting!.voters[0]!;
    expect(gameReducer(off, { type: 'CAST_VOTE', voterId: voter, targetId: ABSTAIN })).toBe(off);
  });

  it('everyone abstains with one imposter: nobody is out, the vote is used up → imposter survives', () => {
    let s = revealAndClue(startGame(makePlayers(5), config({ allowAbstain: true })));
    s = votePlan(s, () => ABSTAIN);
    expect(s.round!.lastVote).toMatchObject({ nobodyOut: true, eliminated: [], needsRevote: false });
    expect(s.round!.lastVote!.tally.abstained).toBe(5);
    expect(s.round!.skippedVotes).toBe(1);
    expect(gameReducer(s, { type: 'CONFIRM_ELIMINATION' })).toBe(s);
    expect(gameReducer(s, { type: 'START_REVOTE' })).toBe(s);
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['imposters'], reason: 'imposterSurvived' });
    s = apply(s, { type: 'FINISH_ROUND' });
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.round!.eliminations).toEqual([]);
  });

  it('everyone abstaining counts like a wrong vote: with two imposters they can no longer all be caught', () => {
    // Same rule as voting out a civilian (one vote per hidden player, and each vote is used up).
    let s = revealAndClue(startGame(makePlayers(7), config({ imposterCount: 2, allowAbstain: true })));
    s = votePlan(s, () => ABSTAIN);
    expect(eliminationsLeft(s.round!)).toBe(1);
    expect(hidden(s)).toHaveLength(2);
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['imposters'], reason: 'imposterSurvived' });
    expect(gameReducer(s, { type: 'CONTINUE_HUNT', to: 'discussion' })).toBe(s);
    s = apply(s, { type: 'FINISH_ROUND' });
    expect(s.round!.result!.winners).toEqual(['imposters']);

    const wrong = voteAll(revealAndClue(startGame(makePlayers(7), config({ imposterCount: 2 }))), voteFor(civilian));
    expect(getNextStep(apply(wrong, { type: 'CONFIRM_ELIMINATION' }))).toEqual({
      kind: 'result',
      winners: ['imposters'],
      reason: 'imposterSurvived',
    });
  });

  it('a partly abstained vote still eliminates the leader; abstain votes score nothing', () => {
    let s = revealAndClue(startGame(makePlayers(5), config({ allowAbstain: true, finalGuess: false })));
    const imp = hidden(s)[0]!;
    let first = true;
    s = votePlan(s, (_v, t) => {
      if (first && t.includes(imp)) {
        first = false;
        return imp;
      }
      return ABSTAIN;
    });
    expect(s.round!.lastVote!.eliminated).toEqual([imp]);
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    s = apply(s, { type: 'FINISH_ROUND' });
    const correct = s.round!.result!.breakdown.filter((l) => l.reason === 'correctVote');
    expect(correct).toHaveLength(1);
  });
});

describe('private vote entry guards', () => {
  it('no duplicate, out-of-turn, self or early-result votes', () => {
    let s = apply(revealAndClue(startGame(makePlayers(4), config())), { type: 'START_VOTING' });
    const [v1, v2] = s.round!.voting!.voters as [string, string];
    expect(gameReducer(s, { type: 'CAST_VOTE', voterId: v2, targetId: v1 })).toBe(s); // not their turn
    expect(gameReducer(s, { type: 'CAST_VOTE', voterId: v1, targetId: v1 })).toBe(s); // self
    s = apply(s, { type: 'CAST_VOTE', voterId: v1, targetId: v2 });
    // A double tap on "lock in" for the same voter is ignored.
    expect(gameReducer(s, { type: 'CAST_VOTE', voterId: v1, targetId: v2 })).toBe(s);
    expect(gameReducer(s, { type: 'REVEAL_VOTES', seed: seedFromNumber(1) })).toBe(s); // not all in
    expect(s.round!.lastVote).toBeNull();
  });

  it('a double "reveal votes" tap resolves the vote once', () => {
    const s = voteAll(
      revealAndClue(startGame(makePlayers(4), config())),
      voteFor((st) => hidden(st)[0]),
    );
    expect(gameReducer(s, { type: 'REVEAL_VOTES', seed: seedFromNumber(2) })).toBe(s);
  });

  it('votes already cast survive a restart; saves from older versions load with safe defaults', () => {
    const key = 'k3y-for-tests-0123456789abcdef';
    let s = apply(revealAndClue(startGame(makePlayers(4), config())), { type: 'START_VOTING' });
    const [v1, v2] = s.round!.voting!.voters as [string, string];
    s = apply(s, { type: 'CAST_VOTE', voterId: v1, targetId: v2 });
    const restored = decodeSave(encodeSave(s, key), key)!;
    expect(restored.round!.voting!.votes).toEqual({ [v1]: [v2] });
    expect(restored.round!.voting!.voterIndex).toBe(1);

    // A save written before abstaining existed (no skippedVotes / allowAbstain / nobodyOut).
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    delete old.round.skippedVotes;
    delete old.round.voting.allowAbstain;
    delete old.round.voting.picks;
    delete old.round.voting.alreadyOut;
    old.round.voting.votes = { [v1]: v2 }; // 1.0 stored one target per voter
    delete old.config.voting;
    delete old.config.allowAbstain;
    const loaded = validateGameState(old)!;
    expect(loaded.round!.skippedVotes).toBe(0);
    expect(loaded.round!.voting!.allowAbstain).toBe(false);
    expect(loaded.round!.voting).toMatchObject({ picks: 1, alreadyOut: [], votes: { [v1]: [v2] } });
    expect(loaded.config.voting).toBe(true); // it was a Full game
    expect(eliminationsLeft(loaded.round!)).toBe(1);
  });
});

describe('category shown = category the word came from', () => {
  it('Random, Mixed and custom topics: the imposter hint and the answer name the word’s own category', () => {
    const src = builtInSource([
      {
        id: 'custom:x',
        name: 'Friends',
        custom: true,
        words: ['Goa', 'Beach'].map((w) => ({
          key: `custom:x:${w}`,
          word: w,
          categoryId: 'custom:x',
          difficulty: 'medium' as const,
          related: [],
          tags: [],
        })),
      },
    ]);
    for (const categoryId of ['random', 'mixed', 'custom:x']) {
      for (let seed = 1; seed <= 25; seed++) {
        const s = startGame(makePlayers(5), config({ categoryId, mode: 'classic', imposterHint: true }), seed, src);
        const { word } = s.round!.setup;
        const category = src.categories.find((c) => c.id === word.categoryId)!;
        expect(category.words.some((w) => w.word === word.word)).toBe(true);
        expect(word.categoryName).toBe(category.name);
        for (const id of hidden(s)) expect(getSecretView(s, id)!.categoryHint).toBe(category.name);
      }
    }
  });
});

/** Every voter names `pick(voter, targets)` (a full ballot, [] = abstain); the vote puts out `n`. */
function voteMany(s: GameState, n: number, pick: (voter: PlayerId, targets: PlayerId[]) => PlayerId[], seed = 5) {
  let st = s.phase === 'VOTING' ? s : apply(s, { type: 'START_VOTING', picks: n });
  for (const voter of st.round!.voting!.voters) {
    st = apply(st, {
      type: 'CAST_VOTE',
      voterId: voter,
      targetIds: pick(voter, eligibleTargets(st.round!.voting!, voter)),
    });
  }
  return apply(st, { type: 'REVEAL_VOTES', seed: seedFromNumber(seed) });
}
/** The hidden players first (never the voter), then others, `n` in total. */
const suspects = (s: GameState, n: number) => (voter: PlayerId, targets: PlayerId[]) =>
  [
    ...hidden(s).filter((h) => h !== voter && targets.includes(h)),
    ...targets.filter((t) => !hidden(s).includes(t)),
  ].slice(0, n);

describe('voting out several players at once', () => {
  it('3 imposters, one vote: each person picks 3, all are caught together, each guesses in turn', () => {
    let s = revealAll(startGame(makePlayers(9), wordsVoting({ imposterCount: 3 })));
    expect(maxVoteOut(s.round!)).toBe(3);
    s = voteMany(s, 3, suspects(s, 3));
    expect(s.round!.lastVote!.eliminated.sort()).toEqual(hidden(s).sort());
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    expect(lastBatch(s.round!)).toHaveLength(3);
    expect(new Set(s.round!.eliminations.map((e) => e.vote)).size).toBe(1);
    // Every caught imposter gets their own final guess, one after another.
    const guessed: string[] = [];
    for (let i = 0; i < 3; i++) {
      const step = getNextStep(s);
      expect(step.kind).toBe('guess');
      if (step.kind !== 'guess') break;
      guessed.push(step.playerId);
      s = apply(s, { type: 'START_GUESS' });
      s = apply(s, { type: 'SUBMIT_GUESS', playerId: step.playerId, guess: 'nope' });
    }
    expect(new Set(guessed).size).toBe(3);
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['civilians'], reason: 'allCaught' });
    s = apply(s, { type: 'FINISH_ROUND' });
    expect(s.round!.result!.winners).toEqual(['civilians']);
  });

  it('a correct guess by any of them wins for the imposters', () => {
    let s = revealAndClue(startGame(makePlayers(7), config({ imposterCount: 2 })));
    s = voteMany(s, 2, suspects(s, 2));
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    const first = (getNextStep(s) as { playerId: string }).playerId;
    s = apply(s, { type: 'START_GUESS' });
    s = apply(s, { type: 'SUBMIT_GUESS', playerId: first, guess: 'wrong' });
    const second = (getNextStep(s) as { playerId: string }).playerId;
    expect(second).not.toBe(first);
    s = apply(s, { type: 'START_GUESS' });
    s = apply(s, { type: 'SUBMIT_GUESS', playerId: second, guess: secret(s) });
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['imposters'], reason: 'imposterGuessed' });
  });

  it('catching only some of them is not a win; a civilian in the batch uses up a vote', () => {
    let s = revealAndClue(startGame(makePlayers(7), config({ imposterCount: 2, finalGuess: false })));
    const [imp] = hidden(s) as [string];
    const civ = civilian(s)!;
    s = voteMany(s, 2, (voter, targets) =>
      [imp, civ].every((x) => targets.includes(x)) ? [imp, civ] : targets.slice(0, 2),
    );
    expect(s.round!.lastVote!.eliminated.sort()).toEqual([imp, civ].sort());
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['imposters'], reason: 'imposterSurvived' });
  });

  it('the jester among the voted out ends the round (jester + imposters win)', () => {
    let s = revealAndClue(
      startGame(makePlayers(8), config({ imposterCount: 2, roles: { jester: true, detective: false } })),
    );
    const jester = idsWithRole(s, 'jester')[0]!;
    const [imp] = hidden(s) as [string];
    s = voteMany(s, 2, (voter, targets) =>
      [imp, jester].every((x) => targets.includes(x)) ? [imp, jester] : targets.slice(0, 2),
    );
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['jester', 'imposters'], reason: 'jesterVotedOut' });
  });

  it('vote size must be 1 … hidden players left; ballots must name exactly that many', () => {
    const s = revealAndClue(startGame(makePlayers(7), config({ imposterCount: 2 })));
    for (const picks of [0, 3, 1.5, -1]) expect(gameReducer(s, { type: 'START_VOTING', picks })).toBe(s);
    const v = apply(s, { type: 'START_VOTING', picks: 2 });
    const voter = v.round!.voting!.voters[0]!;
    const others = eligibleTargets(v.round!.voting!, voter);
    const reject = (targetIds: string[]) =>
      expect(gameReducer(v, { type: 'CAST_VOTE', voterId: voter, targetIds })).toBe(v);
    reject([others[0]!]); // too few
    reject([others[0]!, others[1]!, others[2]!]); // too many
    reject([others[0]!, others[0]!]); // the same player twice
    reject([voter, others[0]!]); // themselves
    reject([]); // abstaining is off
    expect(
      apply(v, { type: 'CAST_VOTE', voterId: voter, targetIds: [others[0]!, others[1]!] }).round!.voting!.votes,
    ).toEqual({ [voter]: [others[0], others[1]] });
  });

  it('a tie for the last place: the clear winner is out, the tied players revote for the place left', () => {
    let s = revealAndClue(startGame(makePlayers(7), config({ imposterCount: 2 })));
    const [a, b, c, d, e, f, g] = s.round!.alive as [string, string, string, string, string, string, string];
    // a: 6 votes, b: 3, c: 3, d: 1, e: 1 → a is out; b and c tie for the second place.
    const plan: Record<string, string[]> = {
      [a]: [b, c],
      [b]: [a, c],
      [c]: [a, b],
      [d]: [a, b],
      [e]: [a, c],
      [f]: [a, d],
      [g]: [a, e],
    };
    s = voteMany(s, 2, (voter) => plan[voter]!);
    const out = s.round!.lastVote!;
    expect(out).toMatchObject({ needsRevote: true, alreadyOut: [a], revotePicks: 1, eliminated: [] });
    expect(out.tied.slice().sort()).toEqual([b, c].sort());
    expect(gameReducer(s, { type: 'CONFIRM_ELIMINATION' })).toBe(s);
    s = apply(s, { type: 'START_REVOTE' });
    expect(s.round!.voting).toMatchObject({ picks: 1, alreadyOut: [a], isRevote: true });
    expect(s.round!.voting!.candidates.slice().sort()).toEqual([b, c].sort());
    s = votePlan(s, (_voter, targets) => (targets.includes(b) ? b : c));
    expect(s.round!.lastVote!.eliminated).toEqual([a, b]);
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    expect(lastBatch(s.round!).map((x) => x.playerId)).toEqual([a, b]);
  });

  it('boundary ties are built exactly and resolved without seating order', () => {
    const base = startVoting(['a', 'b', 'c', 'd', 'e'], undefined, false, 2);
    // a: 4, b: 2, c: 2, d: 1, e: 1 → a is out, b & c tie for the last place.
    const votes = { a: ['b', 'c'], b: ['a', 'c'], c: ['a', 'b'], d: ['a', 'e'], e: ['d', 'a'] };
    const v = { ...base, votes, voterIndex: 5 };
    expect(tallyVotes(votes, base.candidates).counts).toEqual({ a: 4, b: 2, c: 2, d: 1, e: 1 });
    const revote = resolveVote(v, 'revote', seedFromNumber(1));
    expect(revote).toMatchObject({ needsRevote: true, alreadyOut: ['a'], revotePicks: 1, eliminated: [] });
    expect(revote.tied.sort()).toEqual(['b', 'c']);
    const outs = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const r = resolveVote(v, 'random', seedFromNumber(seed));
      expect(r.eliminated[0]).toBe('a');
      expect(r.eliminated).toHaveLength(2);
      outs.add(r.eliminated[1]!);
    }
    expect(outs).toEqual(new Set(['b', 'c']));
  });

  it('everyone abstains in a revote: those already out stay out, the open place is used up', () => {
    const base = startVoting(['a', 'b', 'c', 'd'], ['b', 'c'], true, 1, ['a']);
    const v = { ...base, votes: { a: [], b: [], c: [], d: [] }, voterIndex: 4 };
    expect(resolveVote(v, 'revote', seedFromNumber(3))).toMatchObject({
      eliminated: ['a'],
      unfilled: 1,
      nobodyOut: false,
    });
  });

  it('scores each pick on an imposter once, even when several players go out in the same vote', () => {
    let s = revealAndClue(startGame(makePlayers(7), config({ imposterCount: 2, finalGuess: false })));
    s = voteMany(s, 2, suspects(s, 2));
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    s = apply(s, { type: 'FINISH_ROUND' });
    const votes = s.round!.eliminations[0]!.votes;
    for (const [voter, picks] of Object.entries(votes)) {
      if (!['civilian', 'detective'].includes(s.round!.setup.roles[voter]!)) continue;
      const correct = picks.filter((t) =>
        hidden({ ...s, round: { ...s.round!, alive: s.players.map((p) => p.id) } }).includes(t),
      );
      const got = s.round!.result!.breakdown.filter((l) => l.playerId === voter && l.reason === 'correctVote');
      expect(got).toHaveLength(correct.length);
    }
  });
});

describe('caught out loud', () => {
  it('3 imposters: one agreed out loud, the other two by one phone vote', () => {
    let s = revealAll(startGame(makePlayers(9), wordsVoting({ imposterCount: 3, finalGuess: false })));
    const [first] = hidden(s) as [string];
    s = apply(s, { type: 'VOTE_OUT_LOUD', playerIds: [first] });
    expect(s.phase).toBe('ELIMINATION');
    expect(s.round!.eliminations[0]).toMatchObject({ playerId: first, role: 'imposter', outLoud: true, votes: {} });
    expect(getNextStep(s)).toEqual({ kind: 'continue' });
    s = apply(s, { type: 'CONTINUE_HUNT', to: 'discussion' });
    expect(s.phase).toBe('REVEAL_COMPLETE');
    expect(maxVoteOut(s.round!)).toBe(2);
    s = voteMany(s, 2, suspects(s, 2));
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['civilians'], reason: 'allCaught' });
  });

  it('only with voting on, only living players, and never more than the hidden players left', () => {
    const on = revealAll(startGame(makePlayers(7), wordsVoting({ imposterCount: 2 })));
    const [x, y, z] = on.round!.alive as [string, string, string];
    expect(gameReducer(on, { type: 'VOTE_OUT_LOUD', playerIds: [x, y, z] })).toBe(on);
    expect(gameReducer(on, { type: 'VOTE_OUT_LOUD', playerIds: [x, x] })).toBe(on);
    expect(gameReducer(on, { type: 'VOTE_OUT_LOUD', playerIds: [] })).toBe(on);
    expect(gameReducer(on, { type: 'VOTE_OUT_LOUD', playerIds: ['ghost'] })).toBe(on);
    const off = revealAll(startGame(makePlayers(7), config({ playStyle: 'simple', voting: false, imposterCount: 2 })));
    expect(gameReducer(off, { type: 'VOTE_OUT_LOUD', playerIds: [x] })).toBe(off);
    expect(apply(on, { type: 'VOTE_OUT_LOUD', playerIds: [x, y] }).round!.eliminations).toHaveLength(2);
  });
});
