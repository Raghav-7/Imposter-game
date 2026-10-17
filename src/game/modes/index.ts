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
  /** Imposters see the category name as a hint (when the Imposter hint is on). */
  imposterSeesCategory: boolean;
  /**
   * What the odd one out gets instead of the secret word:
   * - 'none': nothing (Classic, Chaos)
   * - 'related': a similar word (Undercover)
   * - 'otherTopic': a word from a different topic, and they don't know it (Lost)
   * - 'question': a slightly different question, and they don't know it (Questions)
   */
  oddContent: 'none' | 'related' | 'otherTopic' | 'question';
  /** Rolls random chaos modifiers each round. */
  usesModifiers: boolean;
}

export const MODES: Readonly<Record<GameModeId, ModeDefinition>> = {
  classic: {
    id: 'classic',
    emoji: '🎭',
    huntedRole: 'imposter',
    imposterSeesCategory: true,
    oddContent: 'none',
    usesModifiers: false,
  },
  undercover: {
    id: 'undercover',
    emoji: '🥸',
    huntedRole: 'undercover',
    imposterSeesCategory: false,
    oddContent: 'related',
    usesModifiers: false,
  },
  lost: {
    id: 'lost',
    emoji: '🧭',
    huntedRole: 'imposter',
    imposterSeesCategory: false,
    oddContent: 'otherTopic',
    usesModifiers: false,
  },
  questions: {
    id: 'questions',
    emoji: '❓',
    huntedRole: 'imposter',
    imposterSeesCategory: false,
    oddContent: 'question',
    usesModifiers: false,
  },
  chaos: {
    id: 'chaos',
    emoji: '🌀',
    huntedRole: 'imposter',
    imposterSeesCategory: false,
    oddContent: 'none',
    usesModifiers: true,
  },
};

export const MODE_ORDER: readonly GameModeId[] = ['classic', 'undercover', 'lost', 'questions', 'chaos'];

/** The Imposter gets a word or question of their own and a card identical to everyone else's. */
export function imposterIsUnaware(mode: GameModeId): boolean {
  const odd = MODES[mode].oddContent;
  return odd === 'otherTopic' || odd === 'question';
}

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
