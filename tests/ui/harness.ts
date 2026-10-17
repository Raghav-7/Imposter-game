import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AppState, BackHandler } from 'react-native';

import { DEFAULT_GAME_CONFIG } from '../../src/game';
import { translate } from '../../src/localization';
import { configStore, customCategoriesStore, rosterStore } from '../../src/state/appData';
import { __resetGameStoreForTests, startNewGame } from '../../src/state/gameStore';
import { settingsStore } from '../../src/state/settings';
import { statsStore } from '../../src/state/stats';
import { buildWordSource } from '../../src/state/wordSource';
import { TIMING } from '../../src/utils/timing';

/**
 * Shared harness for the UI tests: renders the real app (expo-router file routes) and
 * drives it by pressing buttons, with app-state and hardware-back listeners captured.
 */

type Listener = (state: string) => void;
let appStateListeners: Listener[] = [];
let backListeners: (() => boolean)[] = [];

/** Registers the per-test reset: 4 saved players, Full game with voting, sound and motion off. */
export function installUiHarness() {
  beforeEach(async () => {
    // Drive the UI without component-local delays (their logic is covered in hooks.test.tsx).
    Object.assign(TIMING, { gateArmMs: 0, hideArmMs: 0, voteLockedMs: 0, dealMs: 0, holdRevealMs: 0 });
    await AsyncStorage.clear();
    __resetGameStoreForTests();
    settingsStore.set({
      ...settingsStore.get(),
      onboardingDone: true,
      soundEffects: false,
      haptics: false,
      music: false,
      motion: 'reduced',
    });
    rosterStore.set([
      { id: 'a', name: 'Raghav' },
      { id: 'b', name: 'Arun' },
      { id: 'c', name: 'Priya' },
      { id: 'd', name: 'Karthik' },
    ]);
    // Picking "Full game" in Settings turns voting on.
    configStore.set({ ...DEFAULT_GAME_CONFIG, discussionTimerSec: 30, playStyle: 'full', voting: true });
    customCategoriesStore.set([]);
    statsStore.reset();
    appStateListeners = [];
    backListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, l: Listener) => {
      appStateListeners.push(l);
      return { remove: () => (appStateListeners = appStateListeners.filter((x) => x !== l)) };
    }) as never);
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_type: string, l: () => boolean) => {
      backListeners.push(l);
      return { remove: () => (backListeners = backListeners.filter((x) => x !== l)) };
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
}

export const tick = async (ms = 1000) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

/** Presses once the element exists and is enabled (renders may land a tick late under fake timers). */
export const press = async (testID: string, wait = 600) => {
  for (let i = 0; i < 40; i++) {
    const el = screen.queryByTestId(testID);
    if (el && !el.props.accessibilityState?.disabled) break;
    await tick(100);
  }
  await fireEvent.press(screen.getByTestId(testID));
  await tick(wait);
};

export const background = async () => {
  await act(async () => appStateListeners.slice().forEach((l) => l('background')));
};

export const pressBack = async () => {
  await act(async () => {
    for (const l of backListeners.slice().reverse()) if (l()) break;
  });
};

export async function renderApp(url = '/') {
  await renderRouter('./src/app', { initialUrl: url });
  await tick(1500);
}

/** Starts a game through the store (as the config screen does) and opens the game route. */
export async function startGameUI(players = rosterStore.get()) {
  const source = buildWordSource((k, p) => translate('en', k, p), customCategoriesStore.get());
  expect(startNewGame(players, configStore.get(), source)).toEqual({ ok: true });
  await renderApp('/game');
}
