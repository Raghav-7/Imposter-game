import { QUESTION_PAIRS } from '../../src/data/questions';
import {
  createRoundSetup,
  gameReducer,
  getNextStep,
  getSecretView,
  isGuessCorrect,
  MODE_ORDER,
  normalizeKey,
  seedFromNumber,
  topicsPatch,
  type GameState,
} from '../../src/game';
import { pickQuestion } from '../../src/game/engine/questions';
import { createRng } from '../../src/game/engine/rng';
import {
  apply,
  builtInSource,
  config,
  idsWithRole,
  makePlayers,
  playRoundToResult,
  revealAndClue,
  startGame,
  voteAll,
  voteFor,
} from '../helpers';

const src = builtInSource();
const imposters = (s: GameState) => idsWithRole(s, 'imposter');
const categoryOfWord = (word: string) =>
  src.categories.filter((c) => c.words.some((w) => normalizeKey(w.word) === normalizeKey(word))).map((c) => c.id);

describe('mode list', () => {
  it('Blind is gone; Lost and Questions are in', () => {
    expect(MODE_ORDER).toEqual(['classic', 'undercover', 'lost', 'questions', 'chaos']);
  });
});

describe('Lost', () => {
  it("the Imposter gets a word from another topic on a card that looks like a civilian's", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = startGame(makePlayers(6), config({ mode: 'lost', categoryId: 'random' }), seed);
      const { word, altWord } = s.round!.setup;
      expect(altWord).toBeTruthy();
      expect(normalizeKey(altWord!)).not.toBe(normalizeKey(word.word));
      expect(categoryOfWord(altWord!)).not.toContain(word.categoryId);
      for (const id of imposters(s)) {
        const view = getSecretView(s, id)!;
        expect(view).toMatchObject({ word: altWord, shownRole: 'civilian', categoryHint: null, teammateNames: [] });
      }
      for (const id of idsWithRole(s, 'civilian')) expect(getSecretView(s, id)!.word).toBe(word.word);
    }
  });

  it("the decoy comes from the group's other topics when there are some", () => {
    const cfg = config({ mode: 'lost', ...topicsPatch(['food', 'animals'], src.categories, 'random') });
    for (let seed = 1; seed <= 40; seed++) {
      const { word, altWord } = startGame(makePlayers(5), cfg, seed).round!.setup;
      const other = word.categoryId === 'food' ? 'animals' : 'food';
      expect(categoryOfWord(altWord!)).toContain(other);
    }
  });

  it('a single topic still works: the decoy comes from any other topic', () => {
    const s = startGame(makePlayers(5), config({ mode: 'lost', categoryId: 'cricket' }), 3);
    expect(s.round!.setup.word.categoryId).toBe('cricket');
    expect(categoryOfWord(s.round!.setup.altWord!)).not.toContain('cricket');
  });

  it('a caught Lost imposter who guesses the real word wins; a wrong guess loses', () => {
    const right = playRoundToResult(
      startGame(makePlayers(5), config({ mode: 'lost' })),
      voteFor((s) => imposters(s)[0]),
      (s) => s.round!.setup.word.word,
    );
    expect(right.round!.result).toMatchObject({ winners: ['imposters'], reason: 'imposterGuessed' });
    const wrong = playRoundToResult(
      startGame(makePlayers(5), config({ mode: 'lost' })),
      voteFor((s) => imposters(s)[0]),
      (s) => s.round!.setup.altWord!,
    );
    expect(wrong.round!.result).toMatchObject({ winners: ['civilians'], reason: 'allCaught' });
  });

  it('two Lost imposters share the decoy word', () => {
    const s = startGame(makePlayers(7), config({ mode: 'lost', imposterCount: 2 }), 9);
    const [a, b] = imposters(s) as [string, string];
    expect(getSecretView(s, a)!.word).toBe(getSecretView(s, b)!.word);
  });
});

describe('Questions', () => {
  it('everyone gets a question; the Imposter gets the other question of the pair', () => {
    const sides = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = startGame(makePlayers(5), config({ mode: 'questions' }), seed);
      const { word, altWord } = s.round!.setup;
      const pair = QUESTION_PAIRS.find((q) => [q.a, q.b].includes(word.word))!;
      expect(pair).toBeTruthy();
      expect(altWord).toBe(word.word === pair.a ? pair.b : pair.a);
      sides.add(word.word === pair.a ? 'a' : 'b');
      expect(word.categoryId).toBe('questions');
      for (const p of s.players) {
        const view = getSecretView(s, p.id)!;
        expect(view.contentKind).toBe('question');
        expect(view.shownRole).toBe('civilian');
        expect(view.word).toBe(imposters(s).includes(p.id) ? altWord : word.word);
      }
    }
    expect(sides).toEqual(new Set(['a', 'b'])); // either question can be the group's
  });

  it('topics do not matter: it starts even with every topic switched off', () => {
    const cfg = config({ mode: 'questions', ...topicsPatch([], src.categories, 'random') });
    expect(createRoundSetup(makePlayers(4), cfg, src, seedFromNumber(1)).ok).toBe(true);
  });

  it("final-guess choices hold the group's question, never the Imposter's own, mostly of the same kind", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = pickQuestion(createRng(seedFromNumber(seed)));
      if (!r.ok) throw new Error('no question');
      const { secret, altWord, guessChoices } = r.value;
      expect(guessChoices).toHaveLength(6);
      expect(guessChoices).toContain(secret.word);
      expect(guessChoices).not.toContain(altWord);
      expect(new Set(guessChoices).size).toBe(6);
      const kind = QUESTION_PAIRS.find((q) => q.a === secret.word || q.b === secret.word)!.kind;
      const sameKind = guessChoices.filter((c) =>
        QUESTION_PAIRS.some((q) => q.kind === kind && (q.a === c || q.b === c)),
      );
      expect(sameKind.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('recently used question pairs are skipped', () => {
    const recent = QUESTION_PAIRS.slice(0, QUESTION_PAIRS.length - 1).map((_, i) => `questions:${i}`);
    const r = pickQuestion(createRng(seedFromNumber(5)), recent);
    expect(r.ok && r.value.secret.key).toBe(`questions:${QUESTION_PAIRS.length - 1}`);
  });

  it('picking the real question wins the final guess; a decoy loses', () => {
    let s = revealAndClue(startGame(makePlayers(5), config({ mode: 'questions' })));
    s = voteAll(
      s,
      voteFor((st) => imposters(st)[0]),
    );
    s = apply(s, { type: 'CONFIRM_ELIMINATION' });
    s = apply(s, { type: 'START_GUESS' });
    const guesser = s.round!.pendingGuesser!;
    const decoy = s.round!.setup.guessChoices.find((c) => c !== s.round!.setup.word.word)!;
    expect(isGuessCorrect(decoy, s.round!.setup.word.word)).toBe(false);
    const won = apply(s, { type: 'SUBMIT_GUESS', playerId: guesser, guess: s.round!.setup.word.word });
    expect(getNextStep(won)).toMatchObject({ kind: 'result', winners: ['imposters'], reason: 'imposterGuessed' });
    const lost = apply(s, { type: 'SUBMIT_GUESS', playerId: guesser, guess: decoy });
    expect(getNextStep(lost)).toMatchObject({ kind: 'result', winners: ['civilians'] });
    expect(gameReducer(lost, { type: 'SUBMIT_GUESS', playerId: guesser, guess: s.round!.setup.word.word })).toBe(lost);
  });
});

describe('Detective and Jester work in every mode', () => {
  for (const mode of MODE_ORDER) {
    it(`${mode}: the Detective gets the group's word and real intel; voting out the Jester ends the round`, () => {
      const cfg = config({ mode, roles: { detective: true, jester: true }, chaosModifierCount: 1 });
      const s = startGame(makePlayers(7), cfg, 4);
      const det = idsWithRole(s, 'detective')[0]!;
      const jester = idsWithRole(s, 'jester')[0]!;
      const view = getSecretView(s, det)!;
      expect(view.word).toBe(s.round!.setup.word.word);
      const innocent = s.round!.setup.intel[det];
      expect(innocent?.kind).toBe('innocent');
      if (innocent?.kind === 'innocent')
        expect(['imposter', 'undercover']).not.toContain(s.round!.setup.roles[innocent.playerId]);
      expect(getSecretView(s, jester)!.word).toBe(s.round!.setup.word.word);
      const done = playRoundToResult(
        s,
        voteFor(() => jester),
        () => 'x',
      );
      expect(done.round!.result).toMatchObject({ winners: ['jester', 'imposters'], reason: 'jesterVotedOut' });
    });
  }
});

describe('question list', () => {
  const all = QUESTION_PAIRS.flatMap((q) => [q.a, q.b]);
  it('has 100+ well-formed, unique pairs', () => {
    expect(QUESTION_PAIRS.length).toBeGreaterThanOrEqual(100);
    for (const q of QUESTION_PAIRS) {
      for (const text of [q.a, q.b]) {
        expect(text).toBe(text.trim());
        expect(text.endsWith('?')).toBe(true);
        expect(text.length).toBeLessThanOrEqual(80);
      }
      expect(normalizeKey(q.a)).not.toBe(normalizeKey(q.b));
    }
    expect(new Set(all.map(normalizeKey)).size).toBe(all.length);
  });
});
