import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { configStore, customCategoriesStore, rosterStore } from '../../src/state/appData';
import { __resetGameStoreForTests, getGameState, startNewGame } from '../../src/state/gameStore';
import { buildWordSource } from '../../src/state/wordSource';
import { translate } from '../../src/localization';
import { statsStore } from '../../src/state/stats';
import { formatDisplayWord } from '../../src/utils/wordDisplay';
import { background, installUiHarness, press, pressBack, renderApp, startGameUI, tick } from './harness';

/**
 * End-to-end UI tests: render the real app (expo-router file routes) and play
 * by pressing buttons, exactly as a group would.
 */

jest.setTimeout(120_000);
installUiHarness();

describe('app UI', () => {
  it('home shows primary actions', async () => {
    await renderApp();
    expect(screen.getByTestId('home-play')).toBeTruthy();
    expect(screen.getByTestId('home-quick')).toBeTruthy();
    expect(screen.getByText('Rules')).toBeTruthy();
  });

  it('home hint toggle: off by default, and Quick Play follows it', async () => {
    await renderApp();
    expect(configStore.get().imposterHint).toBe(false);
    expect(screen.getByText('No hint. Imposter gets nothing')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-hint'));
    expect(configStore.get().imposterHint).toBe(true);
    expect(screen.getByText('Imposter sees the category')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-quick'));
    await tick(500);
    expect(getGameState().config.imposterHint).toBe(true);
  });

  it('plays a full classic game through the UI and records stats', async () => {
    await startGameUI();
    await tick(2000); // deal animation auto-advances
    expect(getGameState().phase).toBe('ROLE_REVEAL_INTRO');

    const players = getGameState().players;
    const roles = getGameState().round!.setup.roles;
    for (let i = 0; i < players.length; i++) {
      await tick(1000);
      await press('reveal-gate-ready', 100);
      expect(getGameState().phase).toBe('ROLE_REVEAL');
      const title = screen.getByTestId('role-title').props.children;
      expect(title).toBe(roles[players[i]!.id] === 'imposter' ? "YOU'RE THE IMPOSTER" : 'CIVILIAN');
      if (roles[players[i]!.id] === 'imposter') expect(screen.queryByTestId('role-word')).toBeNull();
      else
        expect(screen.getByTestId('role-word').props.accessibilityLabel).toBe(
          formatDisplayWord(getGameState().round!.setup.word.word),
        );
      await tick(800);
      await press('reveal-hide', 300);
      // The previous card is gone from the tree.
      expect(screen.queryByTestId('role-card')).toBeNull();
    }
    expect(getGameState().phase).toBe('REVEAL_COMPLETE');
    await press('clues-start');
    for (let i = 0; i < players.length; i++) await press('clue-next');
    await press('clue-discuss');
    expect(getGameState().phase).toBe('DISCUSSION');
    await press('discussion-vote');

    const imp = Object.keys(roles).find((id) => roles[id] === 'imposter')!;
    for (let v = 0; v < players.length; v++) {
      await tick(1300);
      await tick(1000);
      await press('vote-gate-ready', 300);
      const voter = getGameState().round!.voting!.voters[v]!;
      const target = voter === imp ? players.find((p) => p.id !== imp)! : players.find((p) => p.id === imp)!;
      await press(`vote-target-${target.name}`, 100);
      // Votes are hidden until everyone is done.
      expect(screen.queryByTestId('vote-out')).toBeNull();
      await press('vote-lock', 300);
    }
    await press('vote-reveal', 2500);
    expect(screen.getByTestId('vote-out')).toBeTruthy();
    await press('vote-reveal-role', 1500);
    expect(getGameState().phase).toBe('ELIMINATION');
    await press('elim-guess', 300);
    await tick(1000);
    await press('guess-gate-ready', 300);
    const wrong = getGameState().round!.setup.guessChoices.find((c) => c !== getGameState().round!.setup.word.word)!;
    await press(`guess-choice-${wrong}`, 100);
    await press('guess-submit', 1500);
    expect(screen.getByTestId('guess-verdict')).toBeTruthy();
    await press('guess-results', 800);
    expect(getGameState().phase).toBe('ROUND_RESULT');
    expect(screen.getByTestId('round-winner').props.children).toBe('CIVILIANS WIN!');
    expect(statsStore.get().totals.rounds).toBe(1);
    await press('round-scoreboard');
    await press('score-end', 1000);
    expect(getGameState().phase).toBe('GAME_COMPLETE');
  });

  it('words-only style: reveal, who starts, hold for the answer, next round (no scores)', async () => {
    configStore.set({ ...configStore.get(), playStyle: 'simple', voting: false });
    await startGameUI();
    await tick(2000);
    const n = getGameState().players.length;
    for (let i = 0; i < n; i++) {
      await press('reveal-gate-ready', 100);
      await press('reveal-hide', 300);
    }
    expect(getGameState().phase).toBe('REVEAL_COMPLETE');
    const round = getGameState().round!;
    const starter = getGameState().players.find((p) => p.id === round.clueOrder[0])!.name;
    expect(screen.getByTestId('simple-start').props.children).toBe(`${starter} starts`);
    expect(screen.queryByTestId('clues-start')).toBeNull();
    expect(screen.queryByTestId('answer-word')).toBeNull(); // nothing secret while the phone is down
    // A plain tap does nothing — the answer needs a press-and-hold.
    await fireEvent.press(screen.getByTestId('answer-hold'));
    expect(getGameState().phase).toBe('REVEAL_COMPLETE');
    await fireEvent(screen.getByTestId('answer-hold'), 'pressIn');
    await tick(300);
    expect(getGameState().phase).toBe('ANSWER');
    const imposter = getGameState().players.find((p) => round.setup.roles[p.id] === 'imposter')!.name;
    expect(screen.getByTestId('answer-imposters').props.children).toBe(imposter);
    expect(screen.getByTestId('answer-word').props.accessibilityLabel).toBe(formatDisplayWord(round.setup.word.word));
    expect(statsStore.get().totals.rounds).toBe(0);
    await press('answer-next', 600);
    expect(getGameState().phase).not.toBe('ANSWER');
    expect(getGameState().round!.number).toBe(2);
  });

  it('config screen starts a game and navigates to it', async () => {
    await renderRouter('./src/app', { initialUrl: '/setup/config' });
    await tick(1500);
    await press('config-start', 1500);
    expect(getGameState().phase).not.toBe('IDLE');
    expect(getGameState().round).not.toBeNull();
    expect(screen.getByTestId(`phase-${getGameState().phase}`)).toBeTruthy(); // the game route is showing
  });

  it('hides a visible secret when the app is backgrounded and requires re-confirmation', async () => {
    await startGameUI();
    await tick(2500);
    await tick(1000);
    await press('reveal-gate-ready', 100);
    expect(screen.getByTestId('role-card')).toBeTruthy();
    await background();
    expect(getGameState().phase).toBe('ROLE_REVEAL_INTRO');
    expect(screen.queryByTestId('role-card')).toBeNull();
    expect(screen.getByTestId('reveal-gate')).toBeTruthy();
  });

  it('back button during a reveal hides the secret instead of navigating, then asks before leaving', async () => {
    await startGameUI();
    await tick(2500);
    await tick(1000);
    await press('reveal-gate-ready', 100);
    await pressBack();
    expect(getGameState().phase).toBe('ROLE_REVEAL_INTRO');
    expect(screen.queryByTestId('role-card')).toBeNull();
    await pressBack();
    await tick(300);
    expect(screen.getByText('Leave this game?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel'));
    await tick(300);
    expect(getGameState().phase).toBe('ROLE_REVEAL_INTRO');
    await pressBack();
    await tick(300);
    await fireEvent.press(screen.getByText('Leave game'));
    await tick(500);
    expect(getGameState().phase).toBe('IDLE');
    expect(getGameState().round).toBeNull();
  });

  it('discussion timer counts down and pauses while the app is backgrounded', async () => {
    await startGameUI();
    await tick(2500);
    const n = getGameState().players.length;
    for (let i = 0; i < n; i++) {
      await tick(1000);
      await press('reveal-gate-ready', 800);
      await press('reveal-hide', 300);
    }
    await press('clues-start');
    for (let i = 0; i < n; i++) await press('clue-next');
    await press('clue-discuss', 300);
    expect(screen.getByText(/^0:(30|29)$/)).toBeTruthy();
    await tick(2_200);
    const shown = () => screen.getByLabelText(/^0:\d\d$/).props.accessibilityLabel as string;
    const before = shown();
    expect(['0:28', '0:27']).toContain(before);
    await background();
    await tick(2_000);
    expect(shown()).toBe(before); // paused while backgrounded
    expect(screen.getByText('Paused while the app was in the background')).toBeTruthy();
    await press('discussion-pause', 300); // resume
    await tick(1_500);
    expect(shown()).not.toBe(before);
  });

  it('player setup validates duplicates and minimum count', async () => {
    rosterStore.set([{ id: 'a', name: 'Raghav' }]);
    await renderApp('/setup/players');
    await fireEvent.changeText(screen.getByTestId('player-add-input'), 'raghav ');
    await press('player-add', 200);
    expect(rosterStore.get()).toHaveLength(1);
    await press('player-quick-add', 200);
    expect(rosterStore.get()).toHaveLength(2);
    expect(screen.getByText('Add at least 3 players')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('player-add-input'), '😎 Neha');
    await press('player-add', 200);
    expect(rosterStore.get().map((p) => p.name)).toEqual(['Raghav', 'Player 2', '😎 Neha']);
  });

  it('creates a custom category and plays with it', async () => {
    await renderApp('/categories/new');
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'My Friends');
    await fireEvent.changeText(screen.getByTestId('editor-add-input'), 'Goa, Pizza\nCricket, goa');
    await press('editor-add', 200);
    await press('editor-save', 500);
    const cat = customCategoriesStore.get()[0]!;
    expect(cat.name).toBe('My Friends');
    expect(cat.words).toEqual(['Goa', 'Pizza', 'Cricket']);
    configStore.set({ ...configStore.get(), categoryId: cat.id });
    await startGameUI();
    expect(['Goa', 'Pizza', 'Cricket']).toContain(getGameState().round!.setup.word.word);
  });

  it('topic picker: tick several topics and every round uses one of them', async () => {
    await renderApp('/setup/category');
    await press('topics-clear', 200);
    expect(screen.getByText('Tick at least one topic to play.')).toBeTruthy();
    expect(screen.getByTestId('topics-done').props.accessibilityState?.disabled).toBe(true);
    await press('category-food', 200);
    await press('category-animals', 200);
    await press('category-tamil_movies', 200);
    await press('category-animals', 200); // untick again
    expect(screen.getByTestId('topics-count').props.children).toMatch(/^2 of \d+ topics on$/);
    const cfg = configStore.get();
    expect(cfg.categoryId).toBe('random');
    for (let i = 0; i < 15; i++) {
      __resetGameStoreForTests();
      const source = buildWordSource((k, p) => translate('en', k, p), customCategoriesStore.get());
      expect(startNewGame(rosterStore.get(), configStore.get(), source)).toEqual({ ok: true });
      expect(['food', 'tamil_movies']).toContain(getGameState().round!.setup.word.categoryId);
    }
  });

  it('categories screen has no second topic selector; it links to the one topic picker', async () => {
    await renderApp('/categories');
    // No duplicate presets or per-topic switches here any more.
    expect(screen.queryByTestId('preset-everyday')).toBeNull();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.getByTestId('categories-topics')).toBeTruthy();
    expect(screen.getByText(/^28 of 28 topics on$/)).toBeTruthy();
    await press('categories-topics', 600);
    // The picker's quick picks change what Random & Mixed draw from.
    await press('topics-preset-everyday', 200);
    expect(configStore.get().excludedCategories).toEqual(expect.arrayContaining(['movies', 'cricket', 'tamil_movies']));
    await press('category-food', 200);
    expect(configStore.get().excludedCategories).toContain('food');
    await press('topics-preset-all', 200);
    expect(configStore.get().excludedCategories).toEqual([]);
  });

  it('renders rules, stats (empty state) and settings screens', async () => {
    await renderApp('/rules');
    expect(screen.getByText('How to play')).toBeTruthy();
    await renderRouter('./src/app', { initialUrl: '/stats' });
    await tick(800);
    expect(screen.getByTestId('stats-empty')).toBeTruthy();
    await renderRouter('./src/app', { initialUrl: '/settings' });
    await tick(800);
    expect(screen.getByText('Reset statistics')).toBeTruthy();
  });

  it('opening /game with no game shows a safe fallback, never a secret', async () => {
    await renderApp('/game');
    expect(screen.getByText('No game in progress')).toBeTruthy();
  });
});
