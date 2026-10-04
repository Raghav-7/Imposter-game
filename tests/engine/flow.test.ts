import {
  canTransition,
  createInitialState,
  createRoundSetup,
  DEFAULT_GAME_CONFIG,
  gameReducer,
  getNextStep,
  seedFromNumber,
  TRANSITIONS,
  type GameState,
  type Phase,
} from '../../src/game';
import {
  apply,
  builtInSource,
  config,
  customCategory,
  idsWithRole,
  makePlayers,
  playRoundToResult,
  revealAndClue,
  startGame,
  voteAll,
  voteFor,
} from '../helpers';

const imposterOf = (s: GameState) => idsWithRole(s, 'imposter', 'undercover')[0];
const firstCivilian = (s: GameState) => s.round!.alive.find((id) => s.round!.setup.roles[id] === 'civilian');
const secret = (s: GameState) => s.round!.setup.word.word;

describe('state machine', () => {
  it('never allows PLAYER_SETUP → VOTE_RESULT (or other undeclared jumps)', () => {
    expect(canTransition('PLAYER_SETUP', 'VOTE_RESULT')).toBe(false);
    expect(canTransition('IDLE', 'VOTING')).toBe(false);
    expect(canTransition('ROLE_REVEAL_INTRO', 'CLUE_PHASE')).toBe(false);
    expect(canTransition('DISCUSSION', 'ROUND_RESULT')).toBe(false);
  });

  it('declares IDLE as an exit from every in-game phase', () => {
    for (const phase of Object.keys(TRANSITIONS) as Phase[]) {
      if (phase === 'IDLE' || phase === 'GAME_COMPLETE') continue;
      expect(TRANSITIONS[phase]).toContain('IDLE');
    }
  });

  it('ignores actions that do not belong to the current phase', () => {
    const s = startGame(makePlayers(4), config());
    for (const action of [
      { type: 'START_VOTING' },
      { type: 'REVEAL_VOTES', seed: seedFromNumber(1) },
      { type: 'FINISH_ROUND' },
      { type: 'SHOW_SECRET', index: 0 },
      { type: 'CONFIRM_ELIMINATION' },
      { type: 'END_GAME' },
    ] as const) {
      expect(gameReducer(s, action)).toBe(s);
    }
  });

  it('setup phases flow IDLE → PLAYER_SETUP → CONFIGURATION and back', () => {
    let s = createInitialState();
    s = apply(s, { type: 'ENTER_SETUP' });
    expect(s.phase).toBe('PLAYER_SETUP');
    s = apply(s, { type: 'ENTER_CONFIG' });
    expect(s.phase).toBe('CONFIGURATION');
    s = apply(s, { type: 'BACK_TO_PLAYERS' });
    expect(s.phase).toBe('PLAYER_SETUP');
  });

  it('rejects START_GAME with a setup that does not match the players', () => {
    const a = startGame(makePlayers(4), config());
    const bad = gameReducer(createInitialState(), {
      type: 'START_GAME',
      players: makePlayers(5),
      config: config(),
      setup: a.round!.setup,
      roundId: 'x',
      sessionId: 'y',
    });
    expect(bad.phase).toBe('IDLE');
  });
});

describe('private reveal', () => {
  it('requires the right player index and hides on background', () => {
    let s = apply(startGame(makePlayers(4), config()), { type: 'BEGIN_REVEAL' });
    expect(gameReducer(s, { type: 'SHOW_SECRET', index: 1 })).toBe(s);
    s = apply(s, { type: 'SHOW_SECRET', index: 0 });
    expect(s.phase).toBe('ROLE_REVEAL');
    s = apply(s, { type: 'APP_BACKGROUNDED' });
    expect(s.phase).toBe('ROLE_REVEAL_INTRO');
    expect(s.round!.revealIndex).toBe(0);
    s = apply(s, { type: 'SHOW_SECRET', index: 0 });
    s = apply(s, { type: 'SECRET_SEEN', index: 0 });
    expect(s.round!.revealIndex).toBe(1);
    // A rapid double "seen" tap for the previous player is ignored.
    expect(gameReducer(s, { type: 'SECRET_SEEN', index: 0 })).toBe(s);
  });

  it('a repeated "show" tap cannot skip players', () => {
    let s = apply(startGame(makePlayers(3), config()), { type: 'BEGIN_REVEAL' });
    s = apply(s, { type: 'SHOW_SECRET', index: 0 });
    expect(gameReducer(s, { type: 'SHOW_SECRET', index: 0 })).toBe(s);
  });
});

describe('end-to-end rounds (engine)', () => {
  it('E2E 1: 3 players, 1 imposter, classic — complete game through scoreboard', () => {
    let s = playRoundToResult(startGame(makePlayers(3), config()), voteFor(imposterOf), () => 'definitely wrong');
    expect(s.phase).toBe('ROUND_RESULT');
    expect(s.round!.result!.winners).toEqual(['civilians']);
    s = apply(s, { type: 'SHOW_SCOREBOARD' });
    s = apply(s, { type: 'END_GAME' });
    expect(s.phase).toBe('GAME_COMPLETE');
    expect(s.round).toBeNull();
  });

  it('E2E 2: 5 players — imposter survives', () => {
    const s = playRoundToResult(startGame(makePlayers(5), config()), voteFor(firstCivilian), () => 'x');
    expect(s.round!.result!.reason).toBe('imposterSurvived');
    expect(s.round!.result!.winners).toEqual(['imposters']);
    const imp = idsWithRole(s, 'imposter')[0]!;
    expect(s.scores[imp]).toBe(3);
  });

  it('E2E 3: imposter caught and guesses correctly → imposter wins', () => {
    const s = playRoundToResult(startGame(makePlayers(5), config()), voteFor(imposterOf), (st) => secret(st));
    expect(s.round!.result!.reason).toBe('imposterGuessed');
    const imp = idsWithRole(s, 'imposter')[0]!;
    expect(s.scores[imp]).toBe(5);
  });

  it('E2E 3b: typed guess tolerates case, spacing and a small typo', () => {
    const s = playRoundToResult(
      startGame(makePlayers(5), config({ categoryId: 'animals' }), 4),
      voteFor(imposterOf),
      (st) => {
        const w = secret(st);
        return `  ${w.toUpperCase()}  `;
      },
    );
    expect(s.round!.result!.reason).toBe('imposterGuessed');
  });

  it('E2E 4: imposter caught and guesses wrong → civilians win, correct voters score', () => {
    const s = playRoundToResult(startGame(makePlayers(5), config()), voteFor(imposterOf), () => 'wrong guess');
    expect(s.round!.result!.reason).toBe('allCaught');
    for (const id of idsWithRole(s, 'civilian')) expect(s.scores[id]).toBe(2 + 1);
    expect(s.scores[idsWithRole(s, 'imposter')[0]!]).toBe(0);
  });

  it('group can accept a close-enough guess', () => {
    let s = revealAndClue(startGame(makePlayers(5), config()));
    s = voteAll(s, voteFor(imposterOf));
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    s = apply(s, { type: 'START_GUESS' });
    const imp = s.round!.pendingGuesser!;
    s = apply(s, { type: 'SUBMIT_GUESS', playerId: imp, guess: 'something else' });
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['civilians'], reason: 'allCaught' });
    // second guess is ignored
    expect(gameReducer(s, { type: 'SUBMIT_GUESS', playerId: imp, guess: secret(s) })).toBe(s);
    s = apply(s, { type: 'ACCEPT_GUESS', playerId: imp });
    expect(getNextStep(s)).toEqual({ kind: 'result', winners: ['imposters'], reason: 'imposterGuessed' });
  });

  it('E2E 5: 10 players / 2 imposters — civilians must catch both', () => {
    const s = playRoundToResult(
      startGame(makePlayers(10), config({ imposterCount: 2 })),
      voteFor((st) => st.round!.alive.find((id) => st.round!.setup.roles[id] === 'imposter')),
      () => 'nope',
    );
    expect(s.round!.eliminations).toHaveLength(2);
    expect(s.round!.result!.winners).toEqual(['civilians']);
  });

  it('E2E 5b: 10 players / 2 imposters — a wrong first vote means imposters win early', () => {
    const s = playRoundToResult(
      startGame(makePlayers(10), config({ imposterCount: 2 })),
      voteFor(firstCivilian),
      () => 'x',
    );
    expect(s.round!.eliminations).toHaveLength(1);
    expect(s.round!.result!.reason).toBe('imposterSurvived');
  });

  it('E2E 6: 15 players / 3 imposters — catching two, missing one → imposters win', () => {
    let caught = 0;
    const s = playRoundToResult(
      startGame(makePlayers(15), config({ imposterCount: 3 })),
      voteFor((st) => {
        const alive = st.round!.alive;
        const imp = alive.find((id) => st.round!.setup.roles[id] === 'imposter');
        return st.round!.eliminations.length < 2 ? imp : alive.find((id) => st.round!.setup.roles[id] === 'civilian');
      }),
      () => {
        caught++;
        return 'wrong';
      },
    );
    expect(caught).toBe(2);
    expect(s.round!.result!.reason).toBe('imposterSurvived');
  });

  it('E2E 7: undercover mode — undercover caught guessing the civilians word', () => {
    const s = playRoundToResult(startGame(makePlayers(6), config({ mode: 'undercover' })), voteFor(imposterOf), (st) =>
      secret(st),
    );
    expect(s.round!.result!.reason).toBe('imposterGuessed');
  });

  it('E2E 8/9: tie triggers a revote between tied players only', () => {
    let s = revealAndClue(startGame(makePlayers(4), config()));
    const [a, b, c, d] = s.round!.alive as [string, string, string, string];
    // a→b, b→a, c→a, d→b  ⇒ a:2, b:2 tie
    const plan: Record<string, string> = { [a]: b, [b]: a, [c]: a, [d]: b };
    s = voteAll(s, (voter) => plan[voter]!);
    expect(s.phase).toBe('VOTE_RESULT');
    expect(s.round!.lastVote!.needsRevote).toBe(true);
    expect(s.round!.lastVote!.tally.leaders.sort()).toEqual([a, b].sort());
    expect(gameReducer(s, { type: 'CONFIRM_ELIMINATION' })).toBe(s);
    s = apply(s, { type: 'START_REVOTE' });
    expect(s.round!.voting!.candidates.sort()).toEqual([a, b].sort());
    expect(s.round!.voting!.voters).toHaveLength(4);
    s = voteAll(s, (voter, targets) => (targets.includes(a) ? a : targets[0]!));
    expect(s.round!.lastVote!.eliminated).toBe(a);
  });

  it('a tie on the revote is broken randomly (never loops)', () => {
    let s = revealAndClue(startGame(makePlayers(4), config()));
    const [a, b, c, d] = s.round!.alive as [string, string, string, string];
    const plan: Record<string, string> = { [a]: b, [b]: a, [c]: a, [d]: b };
    s = voteAll(s, (voter) => plan[voter]!);
    s = apply(s, { type: 'START_REVOTE' });
    s = voteAll(s, (voter) => plan[voter]!);
    expect(s.round!.lastVote!.tieBrokenRandomly).toBe(true);
    expect([a, b]).toContain(s.round!.lastVote!.eliminated);
  });

  it('random tie rule eliminates immediately', () => {
    let s = revealAndClue(startGame(makePlayers(4), config({ tieRule: 'random' })));
    const [a, b, c, d] = s.round!.alive as [string, string, string, string];
    const plan: Record<string, string> = { [a]: b, [b]: a, [c]: a, [d]: b };
    s = voteAll(s, (voter) => plan[voter]!);
    expect(s.round!.lastVote!.needsRevote).toBe(false);
    expect(s.round!.lastVote!.tieBrokenRandomly).toBe(true);
  });

  it('E2E 10: custom category game', () => {
    const src = builtInSource([
      customCategory('custom:friends', ['Goa', 'Pizza', 'Cricket', 'College', 'Beach', 'Coding']),
    ]);
    const players = makePlayers(5);
    const cfg = config({ categoryId: 'custom:friends' });
    let s = startGame(players, cfg, 3, src);
    expect(['Goa', 'Pizza', 'Cricket', 'College', 'Beach', 'Coding']).toContain(secret(s));
    expect(s.round!.setup.guessChoices).toHaveLength(6);
    s = playRoundToResult(s, voteFor(imposterOf), () => 'Goa?');
    expect(s.phase).toBe('ROUND_RESULT');
  });

  it('Jester voted out wins together with the imposters', () => {
    const s = playRoundToResult(
      startGame(makePlayers(6), config({ roles: { jester: true, detective: false } })),
      voteFor((st) => idsWithRole(st, 'jester')[0]),
      () => 'x',
    );
    expect(s.round!.result!.reason).toBe('jesterVotedOut');
    expect(s.round!.result!.winners).toEqual(['jester', 'imposters']);
    expect(s.scores[idsWithRole(s, 'jester')[0]!]).toBe(5);
  });

  it('final guess can be switched off', () => {
    const s = playRoundToResult(startGame(makePlayers(5), config({ finalGuess: false })), voteFor(imposterOf), () => {
      throw new Error('should not guess');
    });
    expect(s.round!.result!.reason).toBe('allCaught');
  });

  it('scores accumulate over multiple rounds and NEXT_ROUND never reuses secrets by reference', () => {
    let s = startGame(makePlayers(5), config());
    const totals: Record<string, number> = {};
    for (let r = 0; r < 5; r++) {
      s = playRoundToResult(s, voteFor(imposterOf), () => 'no');
      for (const [id, d] of Object.entries(s.round!.result!.scoreDeltas)) totals[id] = (totals[id] ?? 0) + d;
      s = apply(s, { type: 'SHOW_SCOREBOARD' });
      if (r < 4) {
        const { createRoundSetup } = jest.requireActual('../../src/game');
        const res = createRoundSetup(s.players, s.config, builtInSource(), seedFromNumber(100 + r));
        const prevRound = s.round!;
        s = apply(s, { type: 'NEXT_ROUND', setup: res.setup, roundId: `n${r}` });
        expect(s.round).not.toBe(prevRound);
        expect(s.round!.eliminations).toEqual([]);
        expect(s.round!.guesses).toEqual([]);
        expect(s.round!.number).toBe(r + 2);
      }
    }
    expect(s.scores).toEqual(totals);
    expect(s.roundsPlayed).toBe(5);
    expect(s.history).toHaveLength(5);
  });

  it('EXIT_GAME wipes the round (no secret can leak into the next game)', () => {
    const s = apply(startGame(makePlayers(5), config()), { type: 'EXIT_GAME' });
    expect(s.phase).toBe('IDLE');
    expect(s.round).toBeNull();
    expect(JSON.stringify(s)).not.toContain('"word"');
  });

  it('peeks are recorded publicly only during clues/discussion', () => {
    let s = revealAndClue(startGame(makePlayers(4), config()));
    const id = s.round!.alive[0]!;
    s = apply(s, { type: 'RECORD_PEEK', playerId: id });
    expect(s.round!.peeks).toEqual([id]);
  });
});

describe('words-only play style (default)', () => {
  const simple = (overrides = {}) => config({ playStyle: 'simple', ...overrides });

  const revealAll = (s: GameState) => {
    let st = apply(s, { type: 'BEGIN_REVEAL' });
    for (let i = 0; i < st.players.length; i++) {
      st = apply(st, { type: 'SHOW_SECRET', index: i });
      st = apply(st, { type: 'SECRET_SEEN', index: i });
    }
    return st;
  };

  it('is the default style', () => {
    expect(DEFAULT_GAME_CONFIG.playStyle).toBe('simple');
  });

  it('after the reveal, goes straight to the answer — no on-phone clues or voting', () => {
    let s = revealAll(startGame(makePlayers(5), simple()));
    expect(s.phase).toBe('REVEAL_COMPLETE');
    expect(gameReducer(s, { type: 'START_CLUES' })).toBe(s); // clue phase is not used
    s = apply(s, { type: 'REVEAL_ANSWER' });
    expect(s.phase).toBe('ANSWER');
    expect(gameReducer(s, { type: 'REVEAL_ANSWER' })).toBe(s); // double tap ignored
  });

  it('full style cannot jump to the answer screen', () => {
    const s = revealAll(startGame(makePlayers(4), config({ playStyle: 'full' })));
    expect(gameReducer(s, { type: 'REVEAL_ANSWER' })).toBe(s);
  });

  it('next round from the answer screen deals a fresh round; no scores are kept', () => {
    let s = apply(revealAll(startGame(makePlayers(4), simple())), { type: 'REVEAL_ANSWER' });
    const res = createRoundSetup(s.players, s.config, builtInSource(), seedFromNumber(77));
    if (!res.ok) throw new Error(res.errors.join());
    s = apply(s, { type: 'NEXT_ROUND', setup: res.setup, roundId: 'r2' });
    expect(s.phase).toBe('WORD_GENERATED');
    expect(s.round!.number).toBe(2);
    expect(Object.values(s.scores).every((v) => v === 0)).toBe(true);
  });

  it('starting player and direction are random, and the speaking order follows the direction', () => {
    const players = makePlayers(6);
    const ids = players.map((p) => p.id);
    const starters = new Set<string>();
    const dirs = new Set<string>();
    for (let seed = 1; seed < 200; seed++) {
      const res = createRoundSetup(players, simple({ categoryId: 'food' }), builtInSource(), seedFromNumber(seed));
      if (!res.ok) throw new Error(res.errors.join());
      const { clueOrder, direction } = res.setup;
      starters.add(clueOrder[0]!);
      dirs.add(direction);
      const start = ids.indexOf(clueOrder[0]!);
      const step = direction === 'clockwise' ? 1 : -1;
      clueOrder.forEach((id, i) => expect(id).toBe(ids[(((start + step * i) % 6) + 6) % 6]));
    }
    expect(starters.size).toBe(6);
    expect(dirs).toEqual(new Set(['clockwise', 'anticlockwise']));
  });

  it('players can re-check their word while the phone is down', () => {
    const s = revealAll(startGame(makePlayers(4), simple()));
    const id = s.players[0]!.id;
    expect(apply(s, { type: 'RECORD_PEEK', playerId: id }).round!.peeks).toEqual([id]);
  });
});
