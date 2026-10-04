import type { GameModeId, ModifierId, RoleId } from '../types';

/**
 * Game-mode registry. To add a mode: add its id to `GameModeId`, describe it
 * here, add `mode.<id>.*` strings and a Rules entry. Mode-specific setup logic
 * lives in `engine/setup.ts`, driven entirely by these flags.
 */
export interface ModeDefinition {
  id: GameModeId;
  emoji: string;
  /** Role given to the hunted players. */
  huntedRole: Extract<RoleId, 'imposter' | 'undercover'>;
  /** Imposters see the category name as a hint. */
  imposterSeesCategory: boolean;
  /** Needs a second, related word. */
  needsAltWord: boolean;
  /** Rolls random chaos modifiers each round. */
  usesModifiers: boolean;
}

export const MODES: Readonly<Record<GameModeId, ModeDefinition>> = {
  classic: {
    id: 'classic',
    emoji: '🎭',
    huntedRole: 'imposter',
    imposterSeesCategory: true,
    needsAltWord: false,
    usesModifiers: false,
  },
  undercover: {
    id: 'undercover',
    emoji: '🥸',
    huntedRole: 'undercover',
    imposterSeesCategory: false,
    needsAltWord: true,
    usesModifiers: false,
  },
  blind: {
    id: 'blind',
    emoji: '🙈',
    huntedRole: 'imposter',
    imposterSeesCategory: false,
    needsAltWord: false,
    usesModifiers: false,
  },
  chaos: {
    id: 'chaos',
    emoji: '🌀',
    huntedRole: 'imposter',
    imposterSeesCategory: false,
    needsAltWord: false,
    usesModifiers: true,
  },
};

export const MODE_ORDER: readonly GameModeId[] = ['classic', 'undercover', 'blind', 'chaos'];

export interface ModifierDefinition {
  id: ModifierId;
  emoji: string;
  /** Relative chance of being rolled. */
  weight: number;
  /** Modifiers that make no sense together. */
  conflicts: readonly ModifierId[];
  /** Changes roles/words (needs extra players or data). */
  structural: boolean;
}

export const MODIFIERS: Readonly<Record<ModifierId, ModifierDefinition>> = {
  shortClues: { id: 'shortClues', emoji: '✂️', weight: 3, conflicts: ['firstOneWord'], structural: false },
  firstOneWord: { id: 'firstOneWord', emoji: '1️⃣', weight: 2, conflicts: ['shortClues'], structural: false },
  noRepeat: { id: 'noRepeat', emoji: '🔁', weight: 2, conflicts: [], structural: false },
  noPhysical: { id: 'noPhysical', emoji: '🚫', weight: 2, conflicts: [], structural: false },
  lastRestriction: { id: 'lastRestriction', emoji: '🤐', weight: 2, conflicts: [], structural: false },
  speedRound: { id: 'speedRound', emoji: '⚡', weight: 2, conflicts: [], structural: false },
  randomOrder: { id: 'randomOrder', emoji: '🎲', weight: 2, conflicts: [], structural: false },
  secretAgent: { id: 'secretAgent', emoji: '🕶️', weight: 2, conflicts: [], structural: true },
  imposterCategory: { id: 'imposterCategory', emoji: '🗂️', weight: 2, conflicts: [], structural: false },
  twoWords: { id: 'twoWords', emoji: '✌️', weight: 2, conflicts: [], structural: true },
};

export const MODIFIER_IDS = Object.keys(MODIFIERS) as ModifierId[];

/** Seconds per clue forced by the speed-round modifier. */
export const SPEED_ROUND_SECONDS = 10;

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;
export const MAX_IMPOSTERS = 3;
