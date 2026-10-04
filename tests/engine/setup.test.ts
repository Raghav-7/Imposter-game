import {
  assignRoles,
  createRng,
  createRoundSetup,
  getSecretView,
  maxImposters,
  pickWord,
  seedFromNumber,
  validatePlayers,
  validateSetup,
  DEFAULT_GAME_CONFIG,
  enabledTopicIds,
  sanitizeConfig,
  topicsPatch,
} from '../../src/game';
import { normalizeKey } from '../../src/game/engine/text';
import { BUILT_IN_CATEGORY_IDS, presetExclusions } from '../../src/data/words';
import { builtInSource, config, customCategory, idsWithRole, makePlayers, startGame } from '../helpers';

describe('player validation', () => {
  it('accepts 3..20 uniquely named players', () => {
    expect(validatePlayers(makePlayers(3))).toEqual([]);
    expect(validatePlayers(makePlayers(20))).toEqual([]);
  });

  it('rejects too few / too many players', () => {
    expect(validatePlayers(makePlayers(2))).toContain('tooFewPlayers');
    expect(validatePlayers(makePlayers(21))).toContain('tooManyPlayers');
  });

  it('rejects blank, duplicate (case/space-insensitive) and over-long names', () => {
    const base = makePlayers(3);
    expect(validatePlayers([...base, { id: 'x', name: '   ' }])).toContain('blankName');
    expect(validatePlayers([...base, { id: 'x', name: '  p1 ' }])).toContain('duplicateName');
    expect(validatePlayers([...base, { id: 'x', name: 'A'.repeat(21) }])).toContain('nameTooLong');
  });

  it('accepts unicode, emoji and one-character names; counts emoji as one character', () => {
    const players = [
      { id: 'a', name: 'प्रिया' },
      { id: 'b', name: '😎' },
      { id: 'c', name: 'Z' },
      { id: 'd', name: '🦁'.repeat(20) },
    ];
    expect(validatePlayers(players)).toEqual([]);
  });

  it('rejects duplicate internal ids', () => {
    expect(validatePlayers([...makePlayers(3), { id: 'id0', name: 'Other' }])).toContain('duplicateId');
  });
});

describe('maxImposters', () => {
  it.each([
    [3, 1],
    [4, 1],
    [5, 2],
    [6, 2],
    [7, 3],
    [10, 3],
    [20, 3],
  ])('%i players → max %i imposters', (n, max) => {
    expect(maxImposters(n, { roles: { detective: false, jester: false } })).toBe(max);
  });

  it('reserves a slot for the Jester', () => {
    expect(maxImposters(3, { roles: { detective: false, jester: true } })).toBe(0);
    expect(maxImposters(4, { roles: { detective: false, jester: true } })).toBe(1);
    expect(maxImposters(6, { roles: { detective: false, jester: true } })).toBe(2);
  });

  it('rejects impossible configs (3p/2i, 4p/3i) and accepts 20p/3i', () => {
    const src = builtInSource();
    expect(validateSetup(makePlayers(3), config({ imposterCount: 2 }), src)).toContain('tooManyImposters');
    expect(validateSetup(makePlayers(4), config({ imposterCount: 3 }), src)).toContain('tooManyImposters');
    expect(validateSetup(makePlayers(20), config({ imposterCount: 3 }), src)).toEqual([]);
    expect(validateSetup(makePlayers(20), config({ imposterCount: 0 }), src)).toContain('tooFewImposters');
  });
});

describe('role assignment', () => {
  it('assigns exactly one role per player with the right imposter count', () => {
    const players = makePlayers(10);
    const roles = assignRoles(createRng(seedFromNumber(3)), players, config({ imposterCount: 3 }), []);
    expect(Object.keys(roles).sort()).toEqual(players.map((p) => p.id).sort());
    expect(Object.values(roles).filter((r) => r === 'imposter')).toHaveLength(3);
    expect(Object.values(roles).filter((r) => r === 'civilian')).toHaveLength(7);
  });

  it('adds Jester and Detective when enabled', () => {
    const roles = assignRoles(
      createRng(seedFromNumber(4)),
      makePlayers(8),
      config({ imposterCount: 2, roles: { detective: true, jester: true } }),
      [],
    );
    const values = Object.values(roles);
    expect(values.filter((r) => r === 'jester')).toHaveLength(1);
    expect(values.filter((r) => r === 'detective')).toHaveLength(1);
    expect(values.filter((r) => r === 'imposter')).toHaveLength(2);
  });

  it('special roles are not present in a normal classic game', () => {
    const s = startGame(makePlayers(6), config());
    expect(new Set(Object.values(s.round!.setup.roles))).toEqual(new Set(['imposter', 'civilian']));
  });
});

describe('word selection', () => {
  it('picks a real word from the chosen category and difficulty', () => {
    const src = builtInSource();
    for (let seed = 0; seed < 200; seed++) {
      const res = pickWord({ categoryId: 'food', difficulty: 'hard' }, src, createRng(seedFromNumber(seed)), {
        needsAltWord: false,
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const entry = src.categories.find((c) => c.id === 'food')!.words.find((w) => w.word === res.value.secret.word);
      expect(entry).toBeDefined();
      expect(entry!.difficulty).toBe('hard');
      expect(res.value.secret.categoryId).toBe('food');
    }
  });

  it('random category picks a single real category', () => {
    const src = builtInSource();
    const res = pickWord({ categoryId: 'random', difficulty: 'easy' }, src, createRng(seedFromNumber(9)), {
      needsAltWord: false,
    });
    expect(res.ok && src.categories.some((c) => c.id === res.value.secret.categoryId)).toBe(true);
  });

  it('includes the secret word exactly once in up to 6 unique guess choices', () => {
    const res = pickWord({ categoryId: 'mixed', difficulty: 'medium' }, builtInSource(), createRng(seedFromNumber(5)), {
      needsAltWord: true,
    });
    if (!res.ok) throw new Error('pick failed');
    const { guessChoices, secret, altWord } = res.value;
    expect(guessChoices.length).toBe(6);
    expect(guessChoices.filter((c) => c === secret.word)).toHaveLength(1);
    expect(new Set(guessChoices.map(normalizeKey)).size).toBe(guessChoices.length);
    expect(guessChoices.map(normalizeKey)).not.toContain(normalizeKey(altWord!));
  });

  it('avoids recently used words when possible', () => {
    const src = builtInSource([customCategory('custom:two', ['Goa', 'Pizza'])]);
    for (let seed = 0; seed < 50; seed++) {
      const res = pickWord({ categoryId: 'custom:two', difficulty: 'easy' }, src, createRng(seedFromNumber(seed)), {
        needsAltWord: false,
        recentKeys: ['custom:two:Goa'],
      });
      expect(res.ok && res.value.secret.word).toBe('Pizza');
    }
  });

  it('reports missing/empty categories instead of crashing', () => {
    const src = builtInSource([customCategory('custom:empty', [])]);
    const rng = createRng(seedFromNumber(1));
    expect(pickWord({ categoryId: 'nope', difficulty: 'easy' }, src, rng, { needsAltWord: false })).toEqual({
      ok: false,
      error: 'categoryMissing',
    });
    expect(pickWord({ categoryId: 'custom:empty', difficulty: 'easy' }, src, rng, { needsAltWord: false })).toEqual({
      ok: false,
      error: 'categoryEmpty',
    });
    expect(validateSetup(makePlayers(4), config({ categoryId: 'custom:empty' }), src)).toContain('categoryEmpty');
  });

  it('one-word custom category works for classic but is rejected for undercover', () => {
    const src = builtInSource([customCategory('custom:one', ['Beach'])]);
    const ok = createRoundSetup(makePlayers(4), config({ categoryId: 'custom:one' }), src, seedFromNumber(1));
    expect(ok.ok && ok.setup.word.word).toBe('Beach');
    const bad = createRoundSetup(
      makePlayers(4),
      config({ categoryId: 'custom:one', mode: 'undercover' }),
      src,
      seedFromNumber(1),
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors).toContain('needsTwoWords');
  });

  it('handles very long custom words and large custom lists', () => {
    const long = 'Supercalifragilisticexpialidocious Extra';
    const many = Array.from({ length: 2000 }, (_, i) => `Word number ${i}`);
    const src = builtInSource([customCategory('custom:big', [long, ...many])]);
    const res = createRoundSetup(
      makePlayers(5),
      config({ categoryId: 'custom:big', mode: 'undercover' }),
      src,
      seedFromNumber(2),
    );
    expect(res.ok).toBe(true);
  });
});

describe('modes', () => {
  it('classic: imposter gets no word but sees the category; civilians see the word', () => {
    const s = startGame(makePlayers(5), config({ mode: 'classic', categoryId: 'food' }));
    const [imp] = idsWithRole(s, 'imposter');
    const view = getSecretView(s, imp!)!;
    expect(view.word).toBeNull();
    expect(view.shownRole).toBe('imposter');
    expect(view.categoryHint).toBe('food');
    for (const id of idsWithRole(s, 'civilian')) expect(getSecretView(s, id)!.word).toBe(s.round!.setup.word.word);
  });

  it('blind: imposter sees nothing at all', () => {
    const s = startGame(makePlayers(5), config({ mode: 'blind' }));
    const view = getSecretView(s, idsWithRole(s, 'imposter')[0]!)!;
    expect(view.word).toBeNull();
    expect(view.categoryHint).toBeNull();
  });

  it('imposter hint off: classic imposter gets no category', () => {
    const s = startGame(makePlayers(5), config({ mode: 'classic', categoryId: 'food', imposterHint: false }));
    const view = getSecretView(s, idsWithRole(s, 'imposter')[0]!)!;
    expect(view.word).toBeNull();
    expect(view.categoryHint).toBeNull();
  });

  it('imposter hint off: chaos never rolls the "imposter knows the category" twist', () => {
    let rolledWithHint = false;
    for (let seed = 1; seed < 300; seed++) {
      const on = createRoundSetup(makePlayers(6), config({ mode: 'chaos' }), builtInSource(), seedFromNumber(seed));
      if (on.ok && on.setup.modifiers.includes('imposterCategory')) rolledWithHint = true;
      const s = startGame(makePlayers(6), config({ mode: 'chaos', imposterHint: false }), seed);
      expect(s.round!.setup.modifiers).not.toContain('imposterCategory');
      for (const id of idsWithRole(s, 'imposter')) expect(getSecretView(s, id)!.categoryHint).toBeNull();
    }
    expect(rolledWithHint).toBe(true);
  });

  it('imposter hint defaults on and old saved settings without it stay on', () => {
    expect(DEFAULT_GAME_CONFIG.imposterHint).toBe(true);
    const { imposterHint: _, ...old } = DEFAULT_GAME_CONFIG;
    expect(sanitizeConfig(old).imposterHint).toBe(true);
    expect(sanitizeConfig({ ...old, imposterHint: false }).imposterHint).toBe(false);
  });

  it('undercover:undercover gets the alternate word and (by default) looks like a civilian', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = startGame(makePlayers(6), config({ mode: 'undercover', imposterCount: 2 }), seed);
      const setup = s.round!.setup;
      expect(setup.altWord).toBeTruthy();
      expect(normalizeKey(setup.altWord!)).not.toBe(normalizeKey(setup.word.word));
      const undercovers = idsWithRole(s, 'undercover');
      expect(undercovers).toHaveLength(2);
      for (const id of undercovers) {
        const v = getSecretView(s, id)!;
        expect(v.word).toBe(setup.altWord);
        expect(v.shownRole).toBe('civilian');
      }
      for (const id of idsWithRole(s, 'civilian')) expect(getSecretView(s, id)!.word).toBe(setup.word.word);
    }
  });

  it('undercover aware option reveals the role', () => {
    const s = startGame(makePlayers(6), config({ mode: 'undercover', undercoverAware: true }));
    expect(getSecretView(s, idsWithRole(s, 'undercover')[0]!)!.shownRole).toBe('undercover');
  });

  it('undercover with a custom category uses another word from it', () => {
    const src = builtInSource([customCategory('custom:f', ['Goa', 'Pizza', 'Beach'])]);
    const res = createRoundSetup(
      makePlayers(4),
      config({ mode: 'undercover', categoryId: 'custom:f' }),
      src,
      seedFromNumber(3),
    );
    if (!res.ok) throw new Error(res.errors.join());
    expect(['Goa', 'Pizza', 'Beach']).toContain(res.setup.altWord);
    expect(res.setup.altWord).not.toBe(res.setup.word.word);
  });

  it('multiple imposters see each other when enabled, not otherwise', () => {
    const s = startGame(makePlayers(10), config({ imposterCount: 3 }));
    const imps = idsWithRole(s, 'imposter');
    const v = getSecretView(s, imps[0]!)!;
    expect(v.teammateNames).toHaveLength(2);
    const hidden = startGame(makePlayers(10), config({ imposterCount: 3, impostersSeeTeammates: false }));
    expect(getSecretView(hidden, idsWithRole(hidden, 'imposter')[0]!)!.teammateNames).toEqual([]);
  });

  it('detective intel names a non-imposter; secret agent intel contains exactly one hidden player', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = startGame(
        makePlayers(9),
        config({ mode: 'chaos', imposterCount: 2, roles: { detective: true, jester: true } }),
        seed,
      );
      const roles = s.round!.setup.roles;
      const det = idsWithRole(s, 'detective')[0]!;
      const intel = s.round!.setup.intel[det];
      expect(intel?.kind).toBe('innocent');
      if (intel?.kind === 'innocent') expect(['imposter', 'undercover']).not.toContain(roles[intel.playerId]);
      const agent = idsWithRole(s, 'agent')[0];
      if (agent) {
        const a = s.round!.setup.intel[agent];
        expect(a?.kind).toBe('suspects');
        if (a?.kind === 'suspects') {
          const hidden = a.playerIds.filter((id) => ['imposter', 'undercover'].includes(roles[id]!));
          expect(hidden).toHaveLength(1);
          expect(a.playerIds).not.toContain(agent);
        }
      }
    }
  });

  it('chaos rolls 1–2 compatible modifiers, and "two words" adds an unaware undercover', () => {
    let sawTwoWords = false;
    for (let seed = 1; seed < 300; seed++) {
      const s = startGame(makePlayers(10), config({ mode: 'chaos', imposterCount: 1 }), seed);
      const mods = s.round!.setup.modifiers;
      expect(mods.length).toBe(2);
      expect(new Set(mods).size).toBe(2);
      expect(mods.includes('shortClues') && mods.includes('firstOneWord')).toBe(false);
      if (mods.includes('twoWords')) {
        sawTwoWords = true;
        const u = idsWithRole(s, 'undercover');
        expect(u).toHaveLength(1);
        expect(getSecretView(s, u[0]!)!.shownRole).toBe('civilian');
        expect(s.round!.eliminationsAllowed).toBe(2);
      }
    }
    expect(sawTwoWords).toBe(true);
  });

  it('chaos never rolls "two words" when there are not enough players', () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = startGame(makePlayers(4), config({ mode: 'chaos' }), seed);
      expect(s.round!.setup.modifiers).not.toContain('twoWords');
    }
  });
});

describe('category toggles for Random & Mixed', () => {
  const src = builtInSource([customCategory('custom:friends', ['Goa', 'Pizza Night', 'Hostel Maggi'])]);

  it('Random never picks a switched-off topic', () => {
    const excluded = ['movies', 'sports', 'cricket', 'bollywood', 'tv_shows', 'celebrities'];
    for (let seed = 0; seed < 400; seed++) {
      const res = createRoundSetup(
        makePlayers(4),
        config({ categoryId: 'random', excludedCategories: excluded, customInRandom: false }),
        src,
        seedFromNumber(seed),
      );
      if (!res.ok) throw new Error(res.errors.join());
      expect(excluded).not.toContain(res.setup.word.categoryId);
      expect(res.setup.word.categoryId).not.toBe('custom:friends');
    }
  });

  it('Mixed only pools enabled topics, and includes custom categories when asked', () => {
    const only = BUILT_IN_CATEGORY_IDS.filter((id) => id !== 'food');
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const res = createRoundSetup(
        makePlayers(4),
        config({ categoryId: 'mixed', excludedCategories: only, customInRandom: true }),
        src,
        seedFromNumber(seed),
      );
      if (!res.ok) throw new Error(res.errors.join());
      seen.add(res.setup.word.categoryId);
    }
    expect(seen).toEqual(new Set(['food', 'custom:friends']));
  });

  it('switching everything off gives a clear error instead of crashing', () => {
    const cfg = config({ categoryId: 'random', excludedCategories: [...BUILT_IN_CATEGORY_IDS], customInRandom: false });
    expect(validateSetup(makePlayers(4), cfg, src)).toContain('noCategoriesEnabled');
    const res = createRoundSetup(makePlayers(4), cfg, src, seedFromNumber(1));
    expect(res.ok).toBe(false);
    // Picking a category directly still works even if it is switched off for Random.
    expect(createRoundSetup(makePlayers(4), { ...cfg, categoryId: 'food' }, src, seedFromNumber(1)).ok).toBe(true);
  });

  it('multi-select: only the ticked topics are ever used, custom ones included', () => {
    const picked = ['food', 'tamil_movies', 'custom:friends'];
    const cfg = config(topicsPatch(picked, src.categories, 'random'));
    expect(enabledTopicIds(cfg, src.categories).sort()).toEqual([...picked].sort());
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const res = createRoundSetup(makePlayers(4), cfg, src, seedFromNumber(seed));
      if (!res.ok) throw new Error(res.errors.join());
      seen.add(res.setup.word.categoryId);
    }
    expect(seen).toEqual(new Set(picked));
  });

  it('multi-select: a custom topic can be ticked off on its own', () => {
    const two = builtInSource([customCategory('custom:a', ['Goa']), customCategory('custom:b', ['Ooty'])]);
    const cfg = config(topicsPatch(['custom:a'], two.categories, 'mixed'));
    expect(cfg.categoryId).toBe('mixed');
    expect(enabledTopicIds(cfg, two.categories)).toEqual(['custom:a']);
    for (let seed = 0; seed < 50; seed++) {
      const res = createRoundSetup(makePlayers(4), cfg, two, seedFromNumber(seed));
      expect(res.ok && res.setup.word.word).toBe('Goa');
    }
  });

  it('multi-select: an older single-category choice shows as that one topic ticked', () => {
    expect(enabledTopicIds(config({ categoryId: 'food' }), src.categories)).toEqual(['food']);
    expect(enabledTopicIds(config({ categoryId: 'custom:gone' }), src.categories)).toEqual([]);
  });

  it('presets: Everyday keeps everyday + India topics and drops cinema/pop', () => {
    const excluded = presetExclusions('everyday');
    expect(excluded).toEqual(expect.arrayContaining(['movies', 'cricket', 'sports', 'tamil_movies']));
    expect(excluded).not.toContain('food');
    expect(excluded).not.toContain('tamil_nadu');
    expect(presetExclusions('all')).toEqual([]);
    expect(presetExclusions('tamil')).not.toContain('tamil_movies');
    expect(presetExclusions('tamil')).toContain('telugu_cinema');
  });

  it('sanitises stored toggles', () => {
    const cfg = sanitizeConfig({ excludedCategories: ['food', 'food', 7, null], customInRandom: 'yes' });
    expect(cfg.excludedCategories).toEqual(['food']);
    expect(cfg.customInRandom).toBe(DEFAULT_GAME_CONFIG.customInRandom);
  });
});
