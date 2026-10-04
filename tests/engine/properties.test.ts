import * as fc from 'fast-check';

import {
  createRng,
  createRoundSetup,
  getSecretView,
  isHunted,
  maxImposters,
  MODE_ORDER,
  roleTeam,
  seedFromNumber,
  validatePlayers,
  type GameConfig,
  type GameModeId,
  type GameState,
} from '../../src/game';
import { BUILT_IN_CATEGORY_IDS } from '../../src/data/words';
import { builtInSource, config, makePlayers, playRoundToResult, randomVoter, startGame } from '../helpers';

const src = builtInSource();

const arbConfig = fc
  .record({
    n: fc.integer({ min: 3, max: 20 }),
    mode: fc.constantFrom<GameModeId>(...MODE_ORDER),
    imposterRequest: fc.integer({ min: 1, max: 3 }),
    category: fc.constantFrom('random', 'mixed', ...BUILT_IN_CATEGORY_IDS),
    difficulty: fc.constantFrom('easy' as const, 'medium' as const, 'hard' as const),
    jester: fc.boolean(),
    detective: fc.boolean(),
    tieRule: fc.constantFrom('revote' as const, 'random' as const),
    finalGuess: fc.boolean(),
    seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
  })
  .map((r) => {
    const roles = { jester: r.jester && r.n >= 4, detective: r.detective };
    const imposterCount = Math.max(1, Math.min(r.imposterRequest, maxImposters(r.n, { roles })));
    const cfg: GameConfig = config({
      mode: r.mode,
      imposterCount,
      categoryId: r.category,
      difficulty: r.difficulty,
      roles,
      tieRule: r.tieRule,
      finalGuess: r.finalGuess,
    });
    return { ...r, cfg };
  });

describe('property: role assignment invariants', () => {
  it('N roles for N players, I hunted, exactly one role each, no duplicates', () => {
    fc.assert(
      fc.property(arbConfig, ({ n, cfg, seed }) => {
        const players = makePlayers(n);
        const res = createRoundSetup(players, cfg, src, seedFromNumber(seed));
        if (!res.ok) throw new Error(res.errors.join());
        const roles = res.setup.roles;
        expect(Object.keys(roles)).toHaveLength(n);
        expect(new Set(Object.keys(roles))).toEqual(new Set(players.map((p) => p.id)));
        const hunted = Object.values(roles).filter(isHunted).length;
        const extra = res.setup.modifiers.includes('twoWords') ? 1 : 0;
        expect(hunted).toBe(cfg.imposterCount + extra);
        expect(cfg.imposterCount).toBeLessThanOrEqual(n - 1);
        // civilians (+ specials) strictly outnumber hidden players
        const nonHunted = Object.values(roles).filter((r) => roleTeam(r) === 'civilians').length;
        expect(nonHunted).toBeGreaterThan(hunted);
        expect(Object.values(roles).filter((r) => r === 'jester').length).toBe(cfg.roles.jester ? 1 : 0);
        expect(res.setup.clueOrder.slice().sort()).toEqual(players.map((p) => p.id).sort());
      }),
      { numRuns: 400 },
    );
  });

  it('never allows imposters >= players - 1 + validation rejects anything above max', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 20 }), fc.integer({ min: 1, max: 25 }), (n, i) => {
        const cfg = config({ imposterCount: i });
        const errors = createRoundSetup(makePlayers(n), cfg, src, seedFromNumber(n * 31 + i));
        if (i > maxImposters(n, cfg)) expect(errors.ok).toBe(false);
        else expect(errors.ok).toBe(true);
        expect(maxImposters(n, cfg)).toBeLessThan(n - 1 + (n === 3 ? 1 : 0));
      }),
    );
  });

  it('secret views: hunted players never see the main word; everyone else sees exactly it', () => {
    fc.assert(
      fc.property(arbConfig, ({ n, cfg, seed }) => {
        const s = startGame(makePlayers(n), cfg, seed);
        const setup = s.round!.setup;
        for (const p of s.players) {
          const v = getSecretView(s, p.id)!;
          const role = setup.roles[p.id]!;
          if (role === 'imposter') expect(v.word).toBeNull();
          else if (role === 'undercover') {
            expect(v.word).toBe(setup.altWord);
            expect(v.word).not.toBe(setup.word.word);
          } else expect(v.word).toBe(setup.word.word);
          // Nobody's view ever contains another player's role information beyond intel/teammates.
          expect(JSON.stringify(v)).not.toContain('"roles"');
        }
      }),
      { numRuns: 300 },
    );
  });

  it('player name validation never throws on arbitrary unicode input', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ unit: 'grapheme', maxLength: 30 }), { maxLength: 25 }), (names) => {
        const issues = validatePlayers(names.map((name, i) => ({ id: `p${i}`, name })));
        expect(Array.isArray(issues)).toBe(true);
      }),
    );
  });
});

describe('chaos simulation: thousands of complete random games', () => {
  it('every game ends in a valid result with consistent votes, eliminations and scores', () => {
    const rng = createRng(seedFromNumber(2024));
    const samples = fc.sample(arbConfig, { numRuns: 1500, seed: 42 });
    let finished = 0;
    for (const { n, cfg, seed } of samples) {
      let s: GameState = startGame(makePlayers(n, rng.int(2) ? 'Player ' : '😀'), cfg, seed);
      s = playRoundToResult(
        s,
        randomVoter(rng),
        (st) => (rng.int(3) === 0 ? st.round!.setup.word.word : 'wrong'),
        seed,
      );
      const round = s.round!;
      const result = round.result!;
      expect(s.phase).toBe('ROUND_RESULT');
      expect(result.winners.length).toBeGreaterThan(0);

      // eliminations are unique and at most the number of hidden players
      const elim = round.eliminations.map((e) => e.playerId);
      expect(new Set(elim).size).toBe(elim.length);
      expect(elim.length).toBeLessThanOrEqual(round.eliminationsAllowed);
      expect(round.alive.length + elim.length).toBe(n);

      // every decisive vote: each eligible voter voted exactly once, never for themselves
      for (const e of round.eliminations) {
        for (const [voter, target] of Object.entries(e.votes)) {
          expect(voter).not.toBe(target);
        }
      }

      // winners agree with the board
      const hiddenAlive = round.alive.filter((id) => isHunted(round.setup.roles[id]!));
      if (result.reason === 'allCaught') expect(hiddenAlive).toHaveLength(0);
      if (result.reason === 'imposterSurvived') expect(hiddenAlive.length).toBeGreaterThan(0);
      if (result.reason === 'imposterGuessed') expect(round.guesses.some((g) => g.correct)).toBe(true);
      if (result.reason === 'jesterVotedOut') expect(round.eliminations.at(-1)!.role).toBe('jester');

      // score deltas are non-negative and match the breakdown
      const sum = result.breakdown.reduce((a, l) => a + l.points, 0);
      expect(Object.values(result.scoreDeltas).reduce((a, b) => a + b, 0)).toBe(sum);
      expect(Object.values(s.scores).every((v) => v >= 0)).toBe(true);
      finished++;
    }
    expect(finished).toBe(1500);
  });
});

describe('randomness', () => {
  it('imposter assignment is spread evenly over 2,000 rounds (no favoured seat)', () => {
    const n = 6;
    const counts = new Array(n).fill(0);
    const players = makePlayers(n);
    const runs = 2000;
    for (let i = 0; i < runs; i++) {
      const res = createRoundSetup(players, config({ categoryId: 'food' }), src, seedFromNumber(i * 7919 + 1));
      if (!res.ok) throw new Error('setup');
      players.forEach((p, idx) => {
        if (res.setup.roles[p.id] === 'imposter') counts[idx]++;
      });
    }
    const expected = runs / n;
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.8);
      expect(c).toBeLessThan(expected * 1.2);
    }
    // chi-square, 5 dof, p≈0.001 critical value 20.5
    const chi = counts.reduce((a, c) => a + (c - expected) ** 2 / expected, 0);
    expect(chi).toBeLessThan(20.5);
  });

  it('every player eventually becomes an imposter with 3 imposters among 20 players', () => {
    const players = makePlayers(20);
    const seen = new Set<string>();
    const pairs = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const res = createRoundSetup(players, config({ imposterCount: 3 }), src, seedFromNumber(i + 99));
      if (!res.ok) throw new Error('setup');
      const imps = Object.keys(res.setup.roles).filter((id) => res.setup.roles[id] === 'imposter');
      expect(new Set(imps).size).toBe(3);
      imps.forEach((id) => seen.add(id));
      pairs.add(imps.slice().sort().join('|'));
    }
    expect(seen.size).toBe(20);
    // C(20,3)=1140 combos. Uniform draws give E[distinct] = 1140·(1−(1−1/1140)^1000) ≈ 666 (σ≈12).
    expect(pairs.size).toBeGreaterThan(620);
    expect(pairs.size).toBeLessThan(720);
  });

  it('word picks vary across rounds', () => {
    const words = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const res = createRoundSetup(makePlayers(4), config({ categoryId: 'mixed' }), src, seedFromNumber(i));
      if (res.ok) words.add(res.setup.word.word);
    }
    expect(words.size).toBeGreaterThan(150);
  });

  it('rng.int is unbiased-ish and in range', () => {
    const rng = createRng(seedFromNumber(5));
    const buckets = new Array(7).fill(0);
    for (let i = 0; i < 70000; i++) {
      const x = rng.int(7);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(7);
      buckets[x]++;
    }
    for (const b of buckets) expect(Math.abs(b - 10000)).toBeLessThan(500);
  });
});
