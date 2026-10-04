import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '../utils/logger';

/** All persisted keys live here so nothing collides and resets are easy. */
export const STORAGE_KEYS = {
  settings: 'ip.settings.v1',
  roster: 'ip.roster.v1',
  config: 'ip.config.v1',
  customCategories: 'ip.customCategories.v1',
  stats: 'ip.stats.v1',
  recentWords: 'ip.recentWords.v1',
  activeGame: 'ip.activeGame.v1',
  saveKey: 'ip.saveKey.v1',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

type FailureListener = (op: 'read' | 'write') => void;
const failureListeners = new Set<FailureListener>();

/** UI subscribes to show a friendly "couldn't save" message instead of crashing. */
export function onStorageFailure(listener: FailureListener): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

function reportFailure(op: 'read' | 'write', key: string, error: unknown) {
  logger.warn(`storage ${op} failed`, { key, error: String(error) });
  failureListeners.forEach((l) => l(op));
}

export async function readRaw(key: StorageKey): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    reportFailure('read', key, error);
    return null;
  }
}

export async function writeRaw(key: StorageKey, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    reportFailure('write', key, error);
    return false;
  }
}

export async function removeKey(key: StorageKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    reportFailure('write', key, error);
  }
}

/**
 * Reads JSON and passes it through `sanitize`. Corrupted JSON or a sanitizer
 * exception yields `fallback` — the app recovers with safe defaults.
 */
export async function readJSON<T>(key: StorageKey, sanitize: (raw: unknown) => T, fallback: T): Promise<T> {
  const raw = await readRaw(key);
  if (raw === null) return fallback;
  try {
    return sanitize(JSON.parse(raw));
  } catch (error) {
    logger.warn('corrupted data replaced with defaults', { key, error: String(error) });
    return fallback;
  }
}

export function writeJSON(key: StorageKey, value: unknown): Promise<boolean> {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch (error) {
    reportFailure('write', key, error);
    return Promise.resolve(false);
  }
  return writeRaw(key, json);
}
