import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_GAME_CONFIG } from '../../src/game';
import {
  __resetGameStoreForTests,
  dispatch,
  enterSetupPhase,
  exitGame,
  getGameState,
  leaveSetup,
  loadSavedGame,
  resumeGame,
  startNewGame,
} from '../../src/state/gameStore';
import { statsStore } from '../../src/state/stats';
import { STORAGE_KEYS } from '../../src/storage/storage';
import { builtInSource, makePlayers } from '../helpers';

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('game store: save / kill / resume', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetGameStoreForTests();
    statsStore.reset();
  });

  it('saves the active game obfuscated and resumes at the pass-the-phone gate', async () => {
    expect(startNewGame(makePlayers(5), { ...DEFAULT_GAME_CONFIG }, builtInSource())).toEqual({ ok: true });
    dispatch({ type: 'BEGIN_REVEAL' });
    dispatch({ type: 'SHOW_SECRET', index: 0 });
    expect(getGameState().phase).toBe('ROLE_REVEAL');
    const word = getGameState().round!.setup.word.word;
    await flush();

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.activeGame);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain(word);
    expect(raw).not.toContain('imposter');

    // Simulate the app being killed: memory wiped.
    __resetGameStoreForTests();
    expect(getGameState().phase).toBe('IDLE');
    const saved = await loadSavedGame();
    expect(saved.kind).toBe('found');
    if (saved.kind !== 'found') return;
    resumeGame(saved.game);
    // Never resumes with a secret on screen.
    expect(getGameState().phase).toBe('ROLE_REVEAL_INTRO');
    expect(getGameState().round!.revealIndex).toBe(0);
  });

  it('reports and deletes corrupted saves', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.activeGame, 'garbage!!');
    expect((await loadSavedGame()).kind).toBe('corrupted');
    expect(await AsyncStorage.getItem(STORAGE_KEYS.activeGame)).toBeNull();
  });

  it('leaving the game deletes the save and wipes secrets from memory', async () => {
    startNewGame(makePlayers(4), { ...DEFAULT_GAME_CONFIG }, builtInSource());
    await flush();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.activeGame)).toBeTruthy();
    exitGame();
    await flush();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.activeGame)).toBeNull();
    expect(getGameState().round).toBeNull();
    expect((await loadSavedGame()).kind).toBe('none');
  });

  it('browsing setup screens does not destroy an interrupted saved game', async () => {
    startNewGame(makePlayers(4), { ...DEFAULT_GAME_CONFIG }, builtInSource());
    await flush();
    __resetGameStoreForTests(); // app restarted, user ignores the resume prompt
    enterSetupPhase('players');
    enterSetupPhase('config');
    leaveSetup();
    await flush();
    expect((await loadSavedGame()).kind).toBe('found');
  });

  it('a new game never carries the previous secret word or roles', () => {
    startNewGame(makePlayers(5), { ...DEFAULT_GAME_CONFIG, categoryId: 'food' }, builtInSource());
    const first = getGameState().round!;
    startNewGame(makePlayers(5), { ...DEFAULT_GAME_CONFIG, categoryId: 'animals' }, builtInSource());
    const second = getGameState().round!;
    expect(second.id).not.toBe(first.id);
    expect(second.setup.word.categoryId).toBe('animals');
    expect(getGameState().roundsPlayed).toBe(0);
    expect(Object.values(getGameState().scores).every((v) => v === 0)).toBe(true);
  });

  it('records stats exactly once when a round finishes', () => {
    startNewGame(makePlayers(3), { ...DEFAULT_GAME_CONFIG, finalGuess: false }, builtInSource());
    const s0 = getGameState();
    dispatch({ type: 'BEGIN_REVEAL' });
    for (let i = 0; i < 3; i++) {
      dispatch({ type: 'SHOW_SECRET', index: i });
      dispatch({ type: 'SECRET_SEEN', index: i });
    }
    dispatch({ type: 'START_CLUES' });
    for (let i = 0; i < 3; i++) dispatch({ type: 'NEXT_CLUE', index: i });
    dispatch({ type: 'START_DISCUSSION' });
    dispatch({ type: 'START_VOTING' });
    const roles = s0.round!.setup.roles;
    const imp = Object.keys(roles).find((id) => roles[id] === 'imposter')!;
    for (const voter of getGameState().round!.voting!.voters) {
      const target = voter === imp ? Object.keys(roles).find((id) => id !== imp)! : imp;
      dispatch({ type: 'CAST_VOTE', voterId: voter, targetId: target });
    }
    dispatch({ type: 'REVEAL_VOTES', seed: [1, 2, 3, 4] });
    dispatch({ type: 'CONFIRM_ELIMINATION' });
    dispatch({ type: 'FINISH_ROUND' });
    dispatch({ type: 'FINISH_ROUND' }); // rapid double tap
    expect(getGameState().phase).toBe('ROUND_RESULT');
    expect(statsStore.get().totals.rounds).toBe(1);
    expect(statsStore.get().totals.civilianWins).toBe(1);
  });
});
