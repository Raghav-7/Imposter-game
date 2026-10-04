import { STORAGE_KEYS } from '../storage/storage';
import { createPersistentStore, useStore } from './persistentStore';

export type ThemeMode = 'dark' | 'light' | 'system';
export type MotionMode = 'system' | 'full' | 'reduced';
export type LanguageSetting = 'system' | 'en' | 'hi';
export type RevealStyle = 'tap' | 'hold';

export interface AppSettings {
  theme: ThemeMode;
  motion: MotionMode;
  language: LanguageSetting;
  soundEffects: boolean;
  music: boolean;
  haptics: boolean;
  revealStyle: RevealStyle;
  /** Lets players re-check their secret during clues/discussion (logged publicly). */
  allowPeek: boolean;
  /** Keep the screen awake during a game. */
  keepAwake: boolean;
  onboardingDone: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  motion: 'system',
  language: 'system',
  soundEffects: true,
  music: false,
  haptics: true,
  revealStyle: 'tap',
  allowPeek: true,
  keepAwake: true,
  onboardingDone: false,
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function sanitizeSettings(raw: unknown): AppSettings {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const b = (v: unknown, f: boolean) => (typeof v === 'boolean' ? v : f);
  return {
    theme: oneOf(r.theme, ['dark', 'light', 'system'] as const, d.theme),
    motion: oneOf(r.motion, ['system', 'full', 'reduced'] as const, d.motion),
    language: oneOf(r.language, ['system', 'en', 'hi'] as const, d.language),
    soundEffects: b(r.soundEffects, d.soundEffects),
    music: b(r.music, d.music),
    haptics: b(r.haptics, d.haptics),
    revealStyle: oneOf(r.revealStyle, ['tap', 'hold'] as const, d.revealStyle),
    allowPeek: b(r.allowPeek, d.allowPeek),
    keepAwake: b(r.keepAwake, d.keepAwake),
    onboardingDone: b(r.onboardingDone, d.onboardingDone),
  };
}

export const settingsStore = createPersistentStore(STORAGE_KEYS.settings, sanitizeSettings, () => ({
  ...DEFAULT_SETTINGS,
}));

export function useSettings(): AppSettings {
  return useStore(settingsStore);
}

export function updateSettings(patch: Partial<AppSettings>) {
  settingsStore.set((prev) => ({ ...prev, ...patch }));
}
