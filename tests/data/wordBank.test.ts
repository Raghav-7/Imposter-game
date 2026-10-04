import { BUILT_IN_CATEGORY_IDS } from '../../src/data/words/categories';
import { RAW_WORDS, totalBuiltInWords, WORD_BANK } from '../../src/data/words';
import { validateWordBank } from '../../src/data/words/validate';

describe('built-in word bank', () => {
  it('has no validation issues (duplicates, empties, bad metadata, missing undercover pairs)', () => {
    const issues = validateWordBank(RAW_WORDS);
    expect(issues).toEqual([]);
  });

  it('contains 1000+ words', () => {
    expect(totalBuiltInWords()).toBeGreaterThanOrEqual(1000);
  });

  it('has a word list for every declared category', () => {
    for (const id of BUILT_IN_CATEGORY_IDS) {
      expect(WORD_BANK[id]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('generates unique keys', () => {
    const keys = Object.values(WORD_BANK)
      .flat()
      .map((w) => w.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('validateWordBank detects problems', () => {
  const base = Array.from({ length: 45 }, (_, i) => ({
    word: `Word ${i}`,
    difficulty: (['easy', 'medium', 'hard'] as const)[i % 3]!,
    related: [`Other ${i}`],
  }));

  it('flags case-insensitive duplicates across categories', () => {
    const issues = validateWordBank({
      food: [...base, { word: 'pizza', difficulty: 'easy', related: ['x'] }],
      animals: [
        ...base.map((w) => ({ ...w, word: `A ${w.word}` })),
        { word: 'PIZZA ', difficulty: 'easy', related: ['y'] },
      ],
    });
    expect(issues.some((i) => i.problem === 'duplicate')).toBe(true);
    expect(issues.some((i) => i.problem === 'untrimmed')).toBe(true);
  });

  it('flags empty words, bad difficulty, missing/self/duplicate related words and unknown categories', () => {
    const issues = validateWordBank({
      nonsense: [
        ...base,
        { word: '  ', difficulty: 'easy', related: ['a'] },
        { word: 'Cat', difficulty: 'impossible' as never, related: [] },
        { word: 'Dog', difficulty: 'easy', related: ['dog'] },
        { word: 'Cow', difficulty: 'easy', related: ['Ox', 'ox'] },
      ],
    });
    const problems = new Set(issues.map((i) => i.problem));
    expect(problems).toEqual(
      new Set(['unknownCategory', 'empty', 'badDifficulty', 'missingRelated', 'relatedIsSelf', 'duplicateRelated']),
    );
  });

  it('flags categories that are too small', () => {
    const issues = validateWordBank({ food: base.slice(0, 5) });
    expect(issues.some((i) => i.problem === 'categoryTooSmall')).toBe(true);
    expect(issues.some((i) => i.problem === 'difficultyTooSmall')).toBe(true);
  });
});
