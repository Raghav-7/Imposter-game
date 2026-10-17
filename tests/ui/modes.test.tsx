import { fireEvent, screen } from '@testing-library/react-native';

import { configStore } from '../../src/state/appData';
import { getGameState } from '../../src/state/gameStore';
import { installUiHarness, press, renderApp, startGameUI, tick } from './harness';

/** Game modes through the real app: Game settings, the cards, and the end of the round. */

jest.setTimeout(120_000);
installUiHarness();

/** Opens each card in turn; returns what every player saw (title + word/question). */
async function revealAndRead() {
  await tick(500);
  const seen: Record<string, { title: string; word: string | undefined }> = {};
  for (const p of getGameState().players) {
    await press('reveal-gate-ready', 100);
    seen[p.id] = {
      title: screen.getByTestId('role-title').props.children as string,
      word: screen.queryByTestId('role-word')?.props.accessibilityLabel as string | undefined,
    };
    await press('reveal-hide', 300);
  }
  return seen;
}

describe('Game settings', () => {
  it('five modes; Questions hides topics and difficulty; the hint switch only where it applies', async () => {
    await renderApp('/setup/config');
    for (const id of ['classic', 'undercover', 'lost', 'questions', 'chaos'])
      expect(screen.getByTestId(`mode-${id}`)).toBeTruthy();
    expect(screen.queryByTestId('mode-blind')).toBeNull();

    await press('mode-questions', 200);
    expect(configStore.get().mode).toBe('questions');
    expect(screen.queryByTestId('config-category')).toBeNull();
    expect(screen.queryByText('Difficulty')).toBeNull();
    expect(screen.getByTestId('config-questions-note')).toBeTruthy();
    await press('config-advanced', 200);
    expect(screen.queryByTestId('config-hint')).toBeNull();

    await press('mode-lost', 200);
    expect(screen.getByTestId('config-category')).toBeTruthy();
    expect(screen.queryByTestId('config-hint')).toBeNull();

    await press('mode-classic', 200);
    expect(screen.getByTestId('config-hint').props.accessibilityState?.checked).toBe(false); // off by default
  });
});

describe('rounds', () => {
  beforeEach(() => {
    configStore.set({ ...configStore.get(), playStyle: 'simple', voting: false });
  });

  it('Questions: every card shows a question; the answer shows both questions', async () => {
    configStore.set({ ...configStore.get(), mode: 'questions' });
    await startGameUI();
    const seen = await revealAndRead();
    const { word, altWord, roles } = getGameState().round!.setup;
    for (const [id, card] of Object.entries(seen)) {
      expect(card.title).toBe('CIVILIAN'); // the Imposter's card looks the same
      expect(card.word).toBe(roles[id] === 'imposter' ? altWord : word.word);
    }
    expect(screen.getByText(/Everyone answers their question out loud/)).toBeTruthy();
    expect(screen.getByText('Forgot your question?')).toBeTruthy();
    await fireEvent(screen.getByTestId('answer-hold'), 'pressIn');
    await tick(300);
    expect(getGameState().phase).toBe('ANSWER');
    expect(screen.getByText("Everyone's question")).toBeTruthy();
    expect(screen.getByText("Imposter's question")).toBeTruthy();
    expect(screen.getByTestId('answer-word').props.children).toBe(word.word);
    expect(screen.getByText(altWord!)).toBeTruthy();
  });

  it("Lost: the Imposter's card looks like a civilian's but holds a word from another topic", async () => {
    configStore.set({ ...configStore.get(), mode: 'lost' });
    await startGameUI();
    const seen = await revealAndRead();
    const { word, altWord, roles } = getGameState().round!.setup;
    const imp = Object.keys(roles).find((id) => roles[id] === 'imposter')!;
    expect(seen[imp]).toEqual({ title: 'CIVILIAN', word: expect.any(String) });
    expect(seen[imp]!.word?.toLowerCase()).toBe(altWord!.toLowerCase());
    expect(seen[imp]!.word?.toLowerCase()).not.toBe(word.word.toLowerCase());
    await fireEvent(screen.getByTestId('answer-hold'), 'pressIn');
    await tick(300);
    expect(screen.getByText("Imposter's word")).toBeTruthy();
  });
});

describe('Rules', () => {
  it('explains Lost and Questions, and no longer mentions Blind', async () => {
    await renderApp('/rules');
    expect(screen.getByText('Lost')).toBeTruthy();
    expect(screen.getByText('Questions')).toBeTruthy();
    expect(screen.queryByText(/Blind/)).toBeNull();
  });
});
