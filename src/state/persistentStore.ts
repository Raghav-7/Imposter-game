import { useSyncExternalStore } from 'react';

import { readJSON, type StorageKey, writeJSON } from '../storage/storage';

export interface PersistentStore<T> {
  get(): T;
  /** Replace the value (or derive it from the previous one) and persist it. */
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
  /** Load from disk once at startup. Safe to call repeatedly. */
  hydrate(): Promise<void>;
  isHydrated(): boolean;
  /** Restore defaults (and persist them). */
  reset(): void;
}

/**
 * Minimal persisted store. Values are sanitised on load so corrupted data
 * falls back to defaults, and writes are serialised so they never race.
 */
export function createPersistentStore<T>(
  key: StorageKey,
  sanitize: (raw: unknown) => T,
  defaults: () => T,
): PersistentStore<T> {
  let value = defaults();
  let hydrated = false;
  let hydrating: Promise<void> | null = null;
  let writeChain: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  const persist = (v: T) => {
    writeChain = writeChain.then(() => writeJSON(key, v)).catch(() => undefined);
  };

  return {
    get: () => value,
    set(next) {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      emit();
      persist(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    hydrate() {
      if (hydrated) return Promise.resolve();
      if (!hydrating) {
        hydrating = readJSON(key, sanitize, defaults()).then((loaded) => {
          value = loaded;
          hydrated = true;
          emit();
        });
      }
      return hydrating;
    },
    isHydrated: () => hydrated,
    reset() {
      value = defaults();
      emit();
      persist(value);
    },
  };
}

export function useStore<T>(store: PersistentStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
