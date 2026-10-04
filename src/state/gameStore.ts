import { useSyncExternalStore } from 'react';

import { createInitialState, type GameAction, gameReducer } from '../game/engine/reducer';
import { decodeSave, encodeSave } from '../game/engine/persist';
import { randomId, randomSeed } from '../game/engine/seed';
import { createRoundSetup, type RoundSetupError } from '../game/engine/setup';
import { isInGame } from '../game/engine/stateMachine';
import type { GameConfig, GameState, Player, WordSource } from '../game/types';
import { readRaw, removeKey, STORAGE_KEYS, writeRaw } from '../storage/storage';
import { logger } from '../utils/logger';
import { configStore, recentWordsStore, rememberWord } from './appData';
import { recordRound, statsStore } from './stats';

let state: GameState = createInitialState();
const listeners = new Set<() => void>();
let saveKey: string | null = null;
let saveChain: Promise<unknown> = Promise.resolve();

function emit() {
  listeners.forEach((l) => l());
}

async function getSaveKey(): Promise<string> {
  if (saveKey) return saveKey;
  const existing = await readRaw(STORAGE_KEYS.saveKey);
  if (existing && existing.length >= 16) {
    saveKey = existing;
    return existing;
  }
  const fresh = Array.from({ length: 4 }, () => randomId()).join('');
  saveKey = fresh;
  await writeRaw(STORAGE_KEYS.saveKey, fresh);
  return fresh;
}

const isResumable = (s: GameState) => isInGame(s.phase) && s.phase !== 'GAME_COMPLETE';

/**
 * Saves the active game after every transition. Setup screens never touch the
 * save, so browsing settings can't destroy an interrupted game; leaving or
 * finishing a game deletes it.
 */
function persist(prev: GameState, next: GameState) {
  const save = isResumable(next);
  const remove = !save && (isInGame(prev.phase) || isInGame(next.phase));
  if (!save && !remove) return;
  saveChain = saveChain
    .then(async () => {
      if (remove) await removeKey(STORAGE_KEYS.activeGame);
      else await writeRaw(STORAGE_KEYS.activeGame, encodeSave(next, await getSaveKey()));
    })
    .catch((error) => logger.warn('could not save game', { error: String(error) }));
}

/** Side effects that must happen exactly once per transition. */
function onTransition(prev: GameState, next: GameState) {
  if (next.round && next.round !== prev.round && next.phase === 'WORD_GENERATED') {
    rememberWord(next.round.setup.word.key);
  }
  if (next.phase === 'ROUND_RESULT' && prev.phase !== 'ROUND_RESULT') {
    // recordRound is idempotent by round id, so a crash/restart can't double count.
    statsStore.set((s) => recordRound(s, next));
  }
}

export function dispatch(action: GameAction): GameState {
  const prev = state;
  const next = gameReducer(prev, action);
  if (next === prev) return prev;
  state = next;
  onTransition(prev, next);
  persist(prev, next);
  emit();
  return next;
}

export function getGameState(): GameState {
  return state;
}

export function subscribeGame(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGameState(): GameState {
  return useSyncExternalStore(subscribeGame, getGameState, getGameState);
}

/* --------------------------------- commands -------------------------------- */

export type StartResult = { ok: true } | { ok: false; errors: RoundSetupError[] };

export function startNewGame(players: Player[], config: GameConfig, source: WordSource): StartResult {
  if (isInGame(state.phase) && state.phase !== 'GAME_COMPLETE') dispatch({ type: 'EXIT_GAME' });
  const res = createRoundSetup(players, config, source, randomSeed(), recentWordsStore.get());
  if (!res.ok) return res;
  const next = dispatch({
    type: 'START_GAME',
    players,
    config,
    setup: res.setup,
    roundId: randomId('r_'),
    sessionId: randomId('s_'),
  });
  if (next.phase !== 'WORD_GENERATED') return { ok: false, errors: ['tooFewPlayers'] };
  configStore.set(config);
  return { ok: true };
}

export function startNextRound(source: WordSource): StartResult {
  const res = createRoundSetup(state.players, state.config, source, randomSeed(), recentWordsStore.get());
  if (!res.ok) return res;
  dispatch({ type: 'NEXT_ROUND', setup: res.setup, roundId: randomId('r_') });
  return { ok: true };
}

export function revealVotes() {
  dispatch({ type: 'REVEAL_VOTES', seed: randomSeed() });
}

/** Leave the current game. The saved game is deleted with it. */
export function exitGame() {
  dispatch({ type: 'EXIT_GAME' });
  saveChain = saveChain.then(() => removeKey(STORAGE_KEYS.activeGame));
}

/** Keeps the state machine in sync with the setup screens (IDLE ↔ PLAYER_SETUP ↔ CONFIGURATION). */
export function enterSetupPhase(step: 'players' | 'config') {
  const phase = state.phase;
  if (step === 'players') {
    if (phase === 'IDLE') dispatch({ type: 'ENTER_SETUP' });
    else if (phase === 'CONFIGURATION') dispatch({ type: 'BACK_TO_PLAYERS' });
  } else {
    if (phase === 'IDLE') dispatch({ type: 'ENTER_SETUP' });
    if (state.phase === 'PLAYER_SETUP') dispatch({ type: 'ENTER_CONFIG' });
  }
}

export function leaveSetup() {
  if (state.phase === 'PLAYER_SETUP' || state.phase === 'CONFIGURATION') dispatch({ type: 'EXIT_GAME' });
}

/* ------------------------------- save / resume ------------------------------ */

export type SavedGameStatus = { kind: 'none' } | { kind: 'found'; game: GameState } | { kind: 'corrupted' };

/** Looks for an interrupted game. Corrupted saves are deleted and reported. */
export async function loadSavedGame(): Promise<SavedGameStatus> {
  const raw = await readRaw(STORAGE_KEYS.activeGame);
  if (!raw) return { kind: 'none' };
  const game = decodeSave(raw, await getSaveKey());
  if (!game || !isInGame(game.phase) || game.phase === 'GAME_COMPLETE') {
    await removeKey(STORAGE_KEYS.activeGame);
    return game ? { kind: 'none' } : { kind: 'corrupted' };
  }
  return { kind: 'found', game };
}

export function resumeGame(game: GameState) {
  if (state.phase !== 'IDLE') dispatch({ type: 'EXIT_GAME' });
  dispatch({ type: 'RESTORE', state: game });
}

export async function discardSavedGame() {
  await removeKey(STORAGE_KEYS.activeGame);
}

/** Test helper: reset module state. */
export function __resetGameStoreForTests() {
  state = createInitialState();
  saveKey = null;
  emit();
}
