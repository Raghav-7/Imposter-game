import { act, render, renderHook, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { formatClock, useCountdown } from '../../src/hooks/useCountdown';
import { PassPhoneGate } from '../../src/screens/game/PassPhoneGate';
import { useArmDelay } from '../../src/utils/useGuardedCallback';

const tick = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

/** Intervals created and not yet cleared (ignores unrelated framework timeouts). */
let activeIntervals = new Set<unknown>();

describe('useCountdown', () => {
  let listeners: ((s: string) => void)[] = [];
  beforeEach(() => {
    jest.useFakeTimers();
    activeIntervals = new Set();
    const realSet = global.setInterval;
    const realClear = global.clearInterval;
    jest.spyOn(global, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
      const id = realSet(fn, ms);
      activeIntervals.add(id);
      return id;
    }) as never);
    jest.spyOn(global, 'clearInterval').mockImplementation(((id: unknown) => {
      activeIntervals.delete(id);
      return realClear(id as never);
    }) as never);
    listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, l: (s: string) => void) => {
      listeners.push(l);
      return { remove: () => (listeners = listeners.filter((x) => x !== l)) };
    }) as never);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('counts down, finishes and stops its interval', async () => {
    const { result } = await renderHook(() => useCountdown(5000));
    await tick(2000);
    expect(Math.ceil(result.current.ms / 1000)).toBe(3);
    await tick(4000);
    expect(result.current.finished).toBe(true);
    expect(result.current.running).toBe(false);
    expect(activeIntervals.size).toBe(0);
  });

  it('pause / resume / add time', async () => {
    const { result } = await renderHook(() => useCountdown(10_000));
    await tick(3000);
    await act(async () => result.current.pause());
    expect(activeIntervals.size).toBe(0); // no interval while paused
    await tick(5000);
    expect(Math.ceil(result.current.ms / 1000)).toBe(7);
    await act(async () => {
      result.current.resume();
      result.current.addTime(30_000);
    });
    await tick(1000);
    expect(Math.ceil(result.current.ms / 1000)).toBe(36);
  });

  it('pauses automatically when the app goes to the background', async () => {
    const { result } = await renderHook(() => useCountdown(10_000));
    await tick(1000);
    await act(async () => listeners.forEach((l) => l('background')));
    expect(result.current.running).toBe(false);
    expect(result.current.pausedByBackground).toBe(true);
    await tick(20_000);
    expect(Math.ceil(result.current.ms / 1000)).toBe(9);
  });

  it('clears its interval on unmount (no leaks) and never creates two', async () => {
    const { unmount } = await renderHook(() => useCountdown(60_000));
    await tick(500);
    expect(activeIntervals.size).toBe(1);
    await act(async () => unmount());
    expect(activeIntervals.size).toBe(0);
  });

  it('works as a stopwatch when duration is 0', async () => {
    const { result } = await renderHook(() => useCountdown(0));
    await tick(65_000);
    expect(formatClock(result.current.ms, false)).toBe('1:05');
    expect(result.current.finished).toBe(false);
  });
});

describe('anti double-tap arming', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('useArmDelay re-arms whenever the key changes', async () => {
    const { result, rerender } = await renderHook(({ k }: { k: string }) => useArmDelay(900, k), {
      initialProps: { k: 'a' },
    });
    expect(result.current).toBe(false);
    await tick(1000);
    expect(result.current).toBe(true);
    await rerender({ k: 'b' });
    expect(result.current).toBe(false);
    await tick(1000);
    expect(result.current).toBe(true);
  });

  it('pass-the-phone gate ignores taps until armed', async () => {
    const onReady = jest.fn();
    await render(<PassPhoneGate heading="h" name="Neha" buttonLabel="go" onReady={onReady} resetKey="k" testID="g" />);
    expect(screen.getByTestId('g-ready').props.accessibilityState.disabled).toBe(true);
    await tick(1000);
    expect(screen.getByTestId('g-ready').props.accessibilityState.disabled).toBe(false);
  });
});
