import { MODES, MODIFIERS, MODIFIER_IDS } from '../modes';
import { isCivilianTeam, isHunted } from '../roles';
import type { GameConfig, Intel, ModifierId, Player, PlayerId, RoleId, RoundSetup, WordSource } from '../types';
import { createRng, pick, type Rng, type Seed, shuffle } from './rng';
import { type SetupIssue, validateSetup } from './validation';
import { type PickWordError, pickWord, resolveCategoryPool } from './words';

export type RoundSetupError = SetupIssue | PickWordError;

export type RoundSetupResult = { ok: true; setup: RoundSetup } | { ok: false; errors: RoundSetupError[] };

/**
 * Builds a complete, random round: word, roles, special intel, modifiers and
 * clue order. Pure given the seed.
 */
export function createRoundSetup(
  players: readonly Player[],
  config: GameConfig,
  source: WordSource,
  seed: Seed,
  recentKeys: readonly string[] = [],
): RoundSetupResult {
  const issues = validateSetup(players, config, source);
  if (issues.length > 0) return { ok: false, errors: issues };

  const rng = createRng(seed);
  const mode = MODES[config.mode];
  const pool = resolveCategoryPool(config.categoryId, source);
  const altPossible = pool !== null && (pool.hasRelated || pool.words.length >= 2);

  const modifiers = mode.usesModifiers ? rollModifiers(rng, players.length, config, altPossible) : [];

  const picked = pickWord(config, source, rng, {
    needsAltWord: mode.needsAltWord || modifiers.includes('twoWords'),
    recentKeys,
  });
  if (!picked.ok) return { ok: false, errors: [picked.error] };

  const roles = assignRoles(rng, players, config, modifiers);
  const intel = buildIntel(rng, roles);

  const ids = players.map((p) => p.id);
  const clueOrder = modifiers.includes('randomOrder') ? shuffle(rng, ids) : rotate(ids, rng.int(ids.length));

  return {
    ok: true,
    setup: {
      word: picked.value.secret,
      altWord: picked.value.altWord,
      roles,
      intel,
      modifiers,
      clueOrder,
      guessChoices: picked.value.guessChoices,
    },
  };
}

function rotate<T>(items: readonly T[], start: number): T[] {
  return [...items.slice(start), ...items.slice(0, start)];
}

/** Can the "two words" chaos modifier fit? It adds one extra hunted undercover. */
export function twoWordsFits(playerCount: number, config: GameConfig): boolean {
  const jester = config.roles.jester ? 1 : 0;
  const hunted = config.imposterCount + 1;
  return playerCount - jester - hunted >= hunted + 1;
}

export function rollModifiers(rng: Rng, playerCount: number, config: GameConfig, altPossible: boolean): ModifierId[] {
  const eligible = MODIFIER_IDS.filter((id) => {
    if (id === 'twoWords') return altPossible && twoWordsFits(playerCount, config);
    return true;
  });
  const chosen: ModifierId[] = [];
  let remaining = eligible.slice();
  const wanted = Math.max(1, Math.min(2, config.chaosModifierCount));
  while (chosen.length < wanted && remaining.length > 0) {
    const total = remaining.reduce((sum, id) => sum + MODIFIERS[id].weight, 0);
    let roll = rng.next() * total;
    let selected = remaining[remaining.length - 1]!;
    for (const id of remaining) {
      roll -= MODIFIERS[id].weight;
      if (roll < 0) {
        selected = id;
        break;
      }
    }
    chosen.push(selected);
    remaining = remaining.filter(
      (id) =>
        id !== selected && !MODIFIERS[selected].conflicts.includes(id) && !MODIFIERS[id].conflicts.includes(selected),
    );
  }
  return chosen;
}

/**
 * Every player gets exactly one role. Hunted players are drawn first from a
 * uniformly shuffled list, so every subset of players is equally likely.
 */
export function assignRoles(
  rng: Rng,
  players: readonly Player[],
  config: GameConfig,
  modifiers: readonly ModifierId[],
): Record<PlayerId, RoleId> {
  const mode = MODES[config.mode];
  const order = shuffle(
    rng,
    players.map((p) => p.id),
  );
  const roles: Record<PlayerId, RoleId> = {};
  let cursor = 0;
  const take = (role: RoleId) => {
    const id = order[cursor++];
    if (id !== undefined) roles[id] = role;
  };

  for (let i = 0; i < config.imposterCount; i++) take(mode.huntedRole);
  if (modifiers.includes('twoWords')) take('undercover');
  if (config.roles.jester) take('jester');
  if (config.roles.detective) take('detective');
  if (modifiers.includes('secretAgent')) take('agent');
  while (cursor < order.length) take('civilian');
  return roles;
}

function buildIntel(rng: Rng, roles: Record<PlayerId, RoleId>): Record<PlayerId, Intel> {
  const intel: Record<PlayerId, Intel> = {};
  const ids = Object.keys(roles);
  const hunted = ids.filter((id) => isHunted(roles[id]!));
  for (const id of ids) {
    const role = roles[id]!;
    if (role === 'detective') {
      const innocent = pick(
        rng,
        ids.filter((other) => other !== id && !isHunted(roles[other]!)),
      );
      if (innocent) intel[id] = { kind: 'innocent', playerId: innocent };
    } else if (role === 'agent') {
      const suspect = pick(rng, hunted);
      const decoy = pick(
        rng,
        ids.filter((other) => other !== id && isCivilianTeam(roles[other]!)),
      );
      if (suspect && decoy) {
        const pair = shuffle(rng, [suspect, decoy]) as [PlayerId, PlayerId];
        intel[id] = { kind: 'suspects', playerIds: pair };
      }
    }
  }
  return intel;
}
