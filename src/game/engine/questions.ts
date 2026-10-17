import { QUESTION_PAIRS, type QuestionPair } from '../../data/questions';
import { pick, type Rng, shuffle } from './rng';
import { normalizeKey } from './text';
import type { PickedWord } from './words';
import { GUESS_CHOICE_COUNT } from './words';

/** Category id given to Questions-mode rounds (there are no topics in this mode). */
export const QUESTIONS_CATEGORY = 'questions';

/**
 * Questions mode: one pair, a random side for the group, the other side for the Imposter.
 * Recently used pairs are skipped while fresh ones remain. Final-guess choices are the group's
 * question plus questions of the same kind, never the Imposter's own.
 */
export function pickQuestion(
  rng: Rng,
  recentKeys: readonly string[] = [],
  pairs: readonly QuestionPair[] = QUESTION_PAIRS,
): { ok: true; value: PickedWord } | { ok: false; error: 'categoryEmpty' } {
  const all = pairs.map((q, i) => ({ ...q, key: `${QUESTIONS_CATEGORY}:${i}` }));
  if (all.length === 0) return { ok: false, error: 'categoryEmpty' };
  const recent = new Set(recentKeys);
  const fresh = all.filter((q) => !recent.has(q.key));
  const chosen = pick(rng, fresh.length > 0 ? fresh : all)!;
  const flip = rng.int(2) === 1;
  const group = flip ? chosen.b : chosen.a;
  const odd = flip ? chosen.a : chosen.b;

  const seen = new Set([normalizeKey(group), normalizeKey(odd)]);
  const decoys: string[] = [];
  const consider = (q: string) => {
    const key = normalizeKey(q);
    if (seen.has(key) || decoys.length >= GUESS_CHOICE_COUNT - 1) return;
    seen.add(key);
    decoys.push(q);
  };
  // Same kind first so the choices are believable, then anything else.
  const others = shuffle(
    rng,
    all.filter((q) => q.key !== chosen.key),
  );
  others.filter((q) => q.kind === chosen.kind).forEach((q) => consider(rng.int(2) === 0 ? q.a : q.b));
  others.forEach((q) => consider(rng.int(2) === 0 ? q.a : q.b));

  return {
    ok: true,
    value: {
      secret: { key: chosen.key, word: group, categoryId: QUESTIONS_CATEGORY, categoryName: '' },
      altWord: odd,
      guessChoices: shuffle(rng, [group, ...decoys]),
    },
  };
}
