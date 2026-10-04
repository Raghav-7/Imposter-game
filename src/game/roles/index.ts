import type { RoleId, Team } from '../types';

/**
 * Role registry. To add a role:
 *  1. Add its id to `RoleId` in types.ts.
 *  2. Register it here (team + what word it receives).
 *  3. Assign it in `engine/setup.ts` (assignSpecialRoles) and, if it gets
 *     extra information, extend `Intel` + `engine/secrets.ts`.
 *  4. Add strings `role.<id>.title|tagline|hint` to localization and an
 *     entry in the Rules screen.
 */
export interface RoleDefinition {
  id: RoleId;
  team: Team;
  /** Which word the role sees on its secret card. */
  receives: 'main' | 'alt' | 'none';
  /** Counts towards the hidden team civilians are hunting. */
  hunted: boolean;
  /** Emoji used on the role card. */
  emoji: string;
}

export const ROLES: Readonly<Record<RoleId, RoleDefinition>> = {
  civilian: { id: 'civilian', team: 'civilians', receives: 'main', hunted: false, emoji: '🙂' },
  detective: { id: 'detective', team: 'civilians', receives: 'main', hunted: false, emoji: '🔍' },
  agent: { id: 'agent', team: 'civilians', receives: 'main', hunted: false, emoji: '🕶️' },
  jester: { id: 'jester', team: 'jester', receives: 'main', hunted: false, emoji: '🃏' },
  imposter: { id: 'imposter', team: 'imposters', receives: 'none', hunted: true, emoji: '🎭' },
  undercover: { id: 'undercover', team: 'imposters', receives: 'alt', hunted: true, emoji: '🥸' },
};

export function roleTeam(role: RoleId): Team {
  return ROLES[role].team;
}

export function isHunted(role: RoleId): boolean {
  return ROLES[role].hunted;
}

export function isCivilianTeam(role: RoleId): boolean {
  return ROLES[role].team === 'civilians';
}
