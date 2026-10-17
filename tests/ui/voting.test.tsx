import { fireEvent, screen, within } from '@testing-library/react-native';
import { type StyleProp, StyleSheet, type TextStyle } from 'react-native';

import { configStore, createCustomCategory, rosterStore } from '../../src/state/appData';
import { getGameState } from '../../src/state/gameStore';
import { statsStore } from '../../src/state/stats';
import { background, installUiHarness, press, pressBack, renderApp, startGameUI, tick } from './harness';

/** Private voting, driven through the real app by pressing buttons. */

jest.setTimeout(120_000);
installUiHarness();

const nameOf = (id: string) => getGameState().players.find((p) => p.id === id)!.name;
const imposterId = () => {
  const roles = getGameState().round!.setup.roles;
  return Object.keys(roles).find((id) => roles[id] === 'imposter')!;
};
const fontSizeOf = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as StyleProp<TextStyle>)?.fontSize;

/** Every player sees their card and hides it again. */
async function revealEveryone() {
  await tick(500);
  for (let i = 0; i < getGameState().players.length; i++) {
    await press('reveal-gate-ready', 100);
    await press('reveal-hide', 300);
  }
  expect(getGameState().phase).toBe('REVEAL_COMPLETE');
}

/** One voter's private turn: open the ballot, pick, lock in. `target` null = abstain. */
async function castVote(target: string | null) {
  await press('vote-gate-ready', 300);
  await press(target === null ? 'vote-abstain' : `vote-target-${nameOf(target)}`, 100);
  await press('vote-lock', 300);
}

async function voteForImposter() {
  const imp = imposterId();
  for (const voter of getGameState().round!.voting!.voters) {
    const target = voter === imp ? getGameState().players.find((p) => p.id !== imp)!.id : imp;
    await castVote(target);
  }
}

describe('Words only + secret voting', () => {
  beforeEach(() => {
    configStore.set({ ...configStore.get(), playStyle: 'simple', voting: true });
  });

  it('talk out loud, then vote privately; results only after the last vote; result → next round', async () => {
    await startGameUI();
    await revealEveryone();
    expect(screen.queryByTestId('answer-hold')).toBeNull(); // voting replaces the hold-for-answer
    await press('simple-vote', 300);
    expect(getGameState().phase).toBe('VOTING');
    // A brief introduction on the first pass-the-phone screen.
    expect(screen.getByText('Secret vote: one vote each. Nobody sees a vote until everyone has voted.')).toBeTruthy();
    expect(screen.queryByTestId('vote-abstain')).toBeNull(); // abstaining is off by default

    const imp = imposterId();
    const voters = getGameState().round!.voting!.voters;
    for (let v = 0; v < voters.length; v++) {
      const voter = voters[v]!;
      const target = voter === imp ? voters.find((id) => id !== imp)! : imp;
      await castVote(target);
      // Nothing about the votes so far is on screen: no picks, no totals, no verdict.
      expect(screen.queryByTestId('vote-out')).toBeNull();
      expect(screen.queryByLabelText(/: \d+ votes?$/)).toBeNull();
      expect(screen.getByTestId('vote-progress').props.children).toBe(`${v + 1} / ${voters.length} votes`);
    }
    await press('vote-reveal', 2500);
    // Every candidate is listed: a bar with their votes, or the "No votes:" line.
    const counts = getGameState().round!.lastVote!.tally.counts;
    const none = screen.queryByTestId('vote-none')?.props.children as string | undefined;
    for (const p of getGameState().players) {
      if ((counts[p.id] ?? 0) > 0)
        expect(screen.getByLabelText(`${p.name}: ${counts[p.id]} vote${counts[p.id] === 1 ? '' : 's'}`)).toBeTruthy();
      else expect(none).toContain(p.name);
    }
    expect(screen.getByTestId('vote-out').props.children).toBe(`${nameOf(imp)} is voted out!`);
    await press('vote-reveal-role', 1500);
    expect(screen.getByTestId('elim-role').props.children).toBe('THE IMPOSTER! 🎭');
    await press('elim-guess', 300);
    await press('guess-gate-ready', 300);
    const wrong = getGameState().round!.setup.guessChoices.find((c) => c !== getGameState().round!.setup.word.word)!;
    await press(`guess-choice-${wrong}`, 100);
    await press('guess-submit', 1500);
    await press('guess-results', 800);
    expect(getGameState().phase).toBe('ROUND_RESULT');
    expect(screen.getByTestId('round-winner').props.children).toBe('CIVILIANS WIN!');
    expect(statsStore.get().totals.rounds).toBe(1); // a real result is recorded
    expect(screen.queryByText(/^\+\d+$/)).toBeNull(); // Words only keeps no points
    expect(screen.queryByTestId('round-scoreboard')).toBeNull();
    await press('round-next', 800);
    expect(getGameState().round!.number).toBe(2);
    expect(getGameState().round!.eliminations).toEqual([]);
  });

  it('abstaining: shown only when allowed; if everyone abstains nobody is out', async () => {
    configStore.set({ ...configStore.get(), allowAbstain: true });
    await startGameUI();
    await revealEveryone();
    await press('simple-vote', 300);
    await press('vote-gate-ready', 300);
    await press('vote-abstain', 100);
    expect(
      screen.getByTestId('vote-lock').props.accessibilityLabel ?? screen.getByText('Lock in: abstain'),
    ).toBeTruthy();
    await press('vote-lock', 300);
    for (let v = 1; v < getGameState().players.length; v++) await castVote(null);
    expect(Object.values(getGameState().round!.voting!.votes).every((t) => t.length === 0)).toBe(true);
    await press('vote-reveal', 2500);
    expect(screen.getByTestId('vote-nobody')).toBeTruthy();
    expect(screen.getByTestId('vote-abstained').props.children).toBe('4 abstained');
    expect(screen.queryByTestId('vote-out')).toBeNull();
    await press('vote-results', 800);
    expect(getGameState().phase).toBe('ROUND_RESULT');
    expect(screen.getByTestId('round-winner').props.children).toBe('IMPOSTERS WIN!');
  });
});

describe('ballot privacy', () => {
  async function toFirstBallot() {
    configStore.set({ ...configStore.get(), playStyle: 'simple', voting: true });
    await startGameUI();
    await revealEveryone();
    await press('simple-vote', 300);
    await press('vote-gate-ready', 300);
    const target = getGameState().round!.voting!.voters[1]!;
    await press(`vote-target-${nameOf(target)}`, 100);
    expect(screen.getByTestId('vote-lock').props.accessibilityState?.disabled).toBeFalsy();
  }

  it('the back button closes an open ballot and clears the pick; no vote is recorded', async () => {
    await toFirstBallot();
    await pressBack();
    await tick(300);
    expect(screen.getByTestId('vote-gate')).toBeTruthy();
    expect(screen.queryByTestId('vote-lock')).toBeNull();
    expect(screen.queryByText('Leave this game?')).toBeNull();
    expect(getGameState().round!.voting!.voterIndex).toBe(0);
    await press('vote-gate-ready', 300);
    expect(screen.getByTestId('vote-lock').props.accessibilityState?.disabled).toBe(true);
  });

  it('backgrounding the app closes an open ballot', async () => {
    await toFirstBallot();
    await background();
    await tick(300);
    expect(screen.getByTestId('vote-gate')).toBeTruthy();
    expect(getGameState().round!.voting!.votes).toEqual({});
  });

  it('a double tap on "lock in" records exactly one vote', async () => {
    await toFirstBallot();
    const lock = screen.getByTestId('vote-lock');
    await fireEvent.press(lock);
    await fireEvent.press(lock);
    await tick(300);
    expect(getGameState().round!.voting!.voterIndex).toBe(1);
    expect(Object.keys(getGameState().round!.voting!.votes)).toHaveLength(1);
    // The next voter starts at a closed gate, never on the previous ballot.
    expect(screen.getByTestId('vote-gate')).toBeTruthy();
  });

  it('the back button during a final guess closes it back to the gate', async () => {
    await startGameUI();
    await revealEveryone();
    await press('clues-start');
    for (let i = 0; i < getGameState().players.length; i++) await press('clue-next');
    await press('clue-discuss');
    await press('discussion-vote');
    await voteForImposter();
    await press('vote-reveal', 2500);
    await press('vote-reveal-role', 1500);
    await press('elim-guess', 300);
    await press('guess-gate-ready', 300);
    expect(screen.getByTestId('guess-submit')).toBeTruthy();
    await pressBack();
    await tick(300);
    expect(screen.getByTestId('guess-gate')).toBeTruthy();
    expect(getGameState().round!.guesses).toEqual([]);
  });
});

describe('voting off', () => {
  it('Full game with voting off: discussion ends with the answer, no voting screens', async () => {
    configStore.set({ ...configStore.get(), voting: false });
    await startGameUI();
    await revealEveryone();
    await press('clues-start');
    for (let i = 0; i < getGameState().players.length; i++) await press('clue-next');
    await press('clue-discuss');
    expect(screen.queryByTestId('discussion-vote')).toBeNull();
    await fireEvent(screen.getByTestId('answer-hold'), 'pressIn');
    await tick(300);
    expect(getGameState().phase).toBe('ANSWER');
    expect(getGameState().round!.voting).toBeNull();
  });
});

describe('several imposters', () => {
  const NAMES = ['Raghav', 'Arun', 'Priya', 'Karthik', 'Neha', 'Divya', 'Sanjay', 'Meena', 'Vikram'];
  const hiddenLeft = () =>
    getGameState().round!.alive.filter((id) => getGameState().round!.setup.roles[id] === 'imposter');

  beforeEach(() => {
    rosterStore.set(NAMES.map((name, i) => ({ id: `p${i}`, name })));
  });

  /** One voter's turn with several picks: hidden players first (never themselves), then others. */
  async function castMany(n: number) {
    await press('vote-gate-ready', 300);
    const voting = getGameState().round!.voting!;
    const voter = voting.voters[voting.voterIndex]!;
    const others = voting.candidates.filter((c) => c !== voter);
    const hidden = hiddenLeft();
    const picks = [...others.filter((c) => hidden.includes(c)), ...others.filter((c) => !hidden.includes(c))].slice(
      0,
      n,
    );
    expect(screen.getByText(`${nameOf(voter)}, pick ${n} Imposters`)).toBeTruthy();
    expect(screen.getByTestId('vote-picked').props.children).toBe(`0 of ${n} picked`);
    expect(screen.getByTestId('vote-lock').props.accessibilityState?.disabled).toBe(true);
    for (const id of picks) await press(`vote-target-${nameOf(id)}`, 50);
    // A further pick is ignored: the ballot never holds more than n names.
    const extra = others.find((c) => !picks.includes(c));
    if (extra) await press(`vote-target-${nameOf(extra)}`, 50);
    expect(screen.getByTestId('vote-picked').props.children).toBe(`${n} of ${n} picked`);
    expect(screen.getByText(`Lock in my ${n} picks`)).toBeTruthy();
    await press('vote-lock', 300);
    expect(getGameState().round!.voting?.votes[voter] ?? getGameState().round!.lastVote?.votes[voter]).toEqual(picks);
  }

  it('3 imposters: one caught out loud, then one phone vote puts out the other two', async () => {
    configStore.set({ ...configStore.get(), playStyle: 'simple', voting: true, imposterCount: 3, finalGuess: false });
    await startGameUI();
    await revealEveryone();
    // The group chooses how many to vote out; it starts at all of them.
    expect(screen.getByTestId('vote-size-3').props.accessibilityState?.selected).toBe(true);
    await press('vote-size-2', 200);
    expect(screen.getByTestId('vote-size-2').props.accessibilityState?.selected).toBe(true);

    // One imposter was caught out loud.
    const loud = hiddenLeft()[0]!;
    await press('out-loud', 300);
    expect(screen.getByTestId('out-loud-sheet')).toBeTruthy();
    await press(`out-loud-${nameOf(loud)}`, 100);
    await press('out-loud-confirm', 1500);
    expect(getGameState().phase).toBe('ELIMINATION');
    expect(getGameState().round!.eliminations[0]).toMatchObject({ playerId: loud, outLoud: true });
    expect(screen.getByTestId('elim-role').props.children).toBe('THE IMPOSTER! 🎭');
    await press('hunt-continue', 600);

    // Two left: the vote-size picker now tops out at 2; one phone vote for both.
    expect(getGameState().phase).toBe('REVEAL_COMPLETE');
    expect(screen.queryByTestId('vote-size-3')).toBeNull();
    expect(screen.getByTestId('vote-size-2').props.accessibilityState?.selected).toBe(true);
    const [x, y] = hiddenLeft() as [string, string];
    await press('simple-vote', 300);
    expect(
      screen.getByText('Secret vote: each person picks 2 players. Nobody sees a vote until everyone has voted.'),
    ).toBeTruthy();
    const voters = getGameState().round!.voting!.voters.length;
    for (let v = 0; v < voters; v++) await castMany(2);
    await press('vote-reveal', 2500);
    const out = screen.getByTestId('vote-out').props.children as string;
    expect([`${nameOf(x)} & ${nameOf(y)} are voted out!`, `${nameOf(y)} & ${nameOf(x)} are voted out!`]).toContain(out);
    await press('vote-reveal-role', 1500);
    expect(screen.getByText('The 2 voted out were…')).toBeTruthy();
    expect(screen.getByTestId(`elim-batch-${x}`)).toBeTruthy();
    expect(screen.getByTestId(`elim-batch-${y}`)).toBeTruthy();
    await press('elim-results', 1000);
    expect(screen.getByTestId('round-winner').props.children).toBe('CIVILIANS WIN!');
  });

  it('two imposters caught together each get their own final guess', async () => {
    rosterStore.set(rosterStore.get().slice(0, 7));
    configStore.set({ ...configStore.get(), playStyle: 'full', voting: true, imposterCount: 2, finalGuess: true });
    await startGameUI();
    await revealEveryone();
    await press('clues-start');
    for (let i = 0; i < getGameState().players.length; i++) await press('clue-next');
    await press('clue-discuss');
    expect(screen.getByTestId('vote-size-2').props.accessibilityState?.selected).toBe(true);
    await press('discussion-vote', 300);
    for (let v = 0; v < getGameState().players.length; v++) await castMany(2);
    await press('vote-reveal', 2500);
    await press('vote-reveal-role', 1500);
    const wrong = () =>
      getGameState().round!.setup.guessChoices.find((c) => c !== getGameState().round!.setup.word.word)!;
    await press('elim-guess', 300);
    const first = getGameState().round!.pendingGuesser!;
    await press('guess-gate-ready', 300);
    await press(`guess-choice-${wrong()}`, 100);
    await press('guess-submit', 1500);
    // The second caught imposter is next, starting at their own pass-the-phone gate.
    await press('guess-next', 600);
    const second = getGameState().round!.pendingGuesser!;
    expect(second).not.toBe(first);
    expect(screen.getByTestId('guess-gate')).toBeTruthy();
    await press('guess-gate-ready', 300);
    await press(`guess-choice-${wrong()}`, 100);
    await press('guess-submit', 1500);
    await press('guess-results', 800);
    expect(screen.getByTestId('round-winner').props.children).toBe('CIVILIANS WIN!');
    expect(
      getGameState()
        .round!.guesses.map((g) => g.playerId)
        .sort(),
    ).toEqual([first, second].sort());
  });
});

describe('setup', () => {
  it('Game settings: one category display, a Voting switch and compact Voting options', async () => {
    await renderApp('/setup/config');
    // The topic row is the only place the category appears (no duplicate summary chip).
    expect(screen.getAllByText('All topics')).toHaveLength(1);
    expect(screen.queryByText('🎲 All topics')).toBeNull();

    expect(screen.queryByTestId('config-abstain')).toBeNull(); // options start collapsed
    await press('config-voting-options', 200);
    await press('config-abstain', 200);
    expect(configStore.get().allowAbstain).toBe(true);
    await press('config-voting', 200);
    expect(configStore.get().voting).toBe(false);
    expect(screen.queryByTestId('config-voting-options')).toBeNull();
    await press('config-advanced', 200);
    expect(screen.queryByText('Keep score')).toBeNull(); // no points without voting
    await press('config-voting', 200);
    expect(configStore.get().voting).toBe(true);
    expect(screen.getByText('Keep score')).toBeTruthy();
  });

  it('choosing a play style in Settings sets its usual voting', async () => {
    await renderApp('/settings');
    await fireEvent.press(screen.getByRole('radio', { name: 'Words only' }));
    expect(configStore.get()).toMatchObject({ playStyle: 'simple', voting: false });
    await fireEvent.press(screen.getByRole('radio', { name: 'Full game' }));
    expect(configStore.get()).toMatchObject({ playStyle: 'full', voting: true });
  });

  it('Quick Play keeps the voting choice and never overwrites the saved Game settings', async () => {
    configStore.set({
      ...configStore.get(),
      mode: 'undercover',
      difficulty: 'hard',
      roles: { detective: true, jester: false },
      allowAbstain: true,
    });
    const saved = configStore.get();
    await renderApp('/');
    await press('home-quick', 800);
    expect(getGameState().config).toMatchObject({ mode: 'classic', voting: true, allowAbstain: true });
    expect(configStore.get()).toEqual(saved);
  });
});

describe('secret word typography', () => {
  it('shows a custom lowercase word in Title Case with larger initials, without changing the word', async () => {
    const cat = createCustomCategory('Desserts', ['ice cream']);
    configStore.set({ ...configStore.get(), categoryId: cat.id });
    await startGameUI();
    expect(getGameState().round!.setup.word.word).toBe('ice cream'); // the data is untouched
    await tick(500);
    const imp = imposterId();
    const civilianIndex = getGameState().players.findIndex((p) => p.id !== imp);
    for (let i = 0; i < civilianIndex; i++) {
      await press('reveal-gate-ready', 100);
      await press('reveal-hide', 300);
    }
    await press('reveal-gate-ready', 100);
    const word = screen.getByTestId('role-word');
    expect(word.props.accessibilityLabel).toBe('Ice Cream');
    const big = [within(word).getByText('I'), within(word).getByText('C')];
    const rest = fontSizeOf(word)!;
    for (const initial of big) expect(fontSizeOf(initial)!).toBeGreaterThan(rest);
    expect(fontSizeOf(big[0]!)).toBe(fontSizeOf(big[1]!));
  });
});
