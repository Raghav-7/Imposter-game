import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export interface Countdown {
  /** Remaining ms (counts down), or elapsed ms when `durationMs` is 0 (stopwatch). */
  ms: number;
  running: boolean;
  finished: boolean;
  /** True when the timer was paused automatically because the app left the foreground. */
  pausedByBackground: boolean;
  pause: () => void;
  resume: () => void;
  addTime: (ms: number) => void;
  restart: () => void;
}

/**
 * Wall-clock based countdown (or stopwatch when durationMs = 0).
 * - Exactly one interval exists at a time and it is cleared on unmount.
 * - The interval only runs while the timer is running.
 * - Backgrounding the app pauses the timer; the user resumes explicitly.
 */
export function useCountdown(durationMs: number, opts: { autoStart?: boolean; tickMs?: number } = {}): Countdown {
  const { autoStart = true, tickMs = 250 } = opts;
  const stopwatch = durationMs <= 0;
  const [ms, setMs] = useState(stopwatch ? 0 : durationMs);
  const [running, setRunning] = useState(autoStart);
  const [pausedByBackground, setPausedByBackground] = useState(false);

  // Accumulated time from previous running segments + start of the current segment.
  const baseRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const totalRef = useRef(durationMs);

  const elapsed = useCallback(
    () => baseRef.current + (segmentStartRef.current !== null ? Date.now() - segmentStartRef.current : 0),
    [],
  );

  const compute = useCallback(
    () => (stopwatch ? elapsed() : Math.max(0, totalRef.current - elapsed())),
    [elapsed, stopwatch],
  );

  const pause = useCallback(() => {
    if (segmentStartRef.current === null) return;
    baseRef.current = elapsed();
    segmentStartRef.current = null;
    setRunning(false);
    setMs(compute());
  }, [compute, elapsed]);

  const resume = useCallback(() => {
    if (segmentStartRef.current !== null) return;
    if (!stopwatch && compute() <= 0) return;
    segmentStartRef.current = Date.now();
    setPausedByBackground(false);
    setRunning(true);
  }, [compute, stopwatch]);

  const addTime = useCallback(
    (extra: number) => {
      totalRef.current += extra;
      setMs(compute());
    },
    [compute],
  );

  const restart = useCallback(() => {
    baseRef.current = 0;
    totalRef.current = durationMs;
    segmentStartRef.current = Date.now();
    setPausedByBackground(false);
    setRunning(true);
    setMs(stopwatch ? 0 : durationMs);
  }, [durationMs, stopwatch]);

  // Start the clock on mount (reading the time during render would be impure).
  useEffect(() => {
    if (startedRef.current || !autoStart) return;
    startedRef.current = true;
    segmentStartRef.current = Date.now();
  }, [autoStart]);

  // Single interval while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const value = compute();
      setMs(value);
      if (!stopwatch && value <= 0) {
        baseRef.current = totalRef.current;
        segmentStartRef.current = null;
        setRunning(false);
      }
    }, tickMs);
    return () => clearInterval(id);
  }, [running, compute, stopwatch, tickMs]);

  // Pause on background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && segmentStartRef.current !== null) {
        pause();
        setPausedByBackground(true);
      }
    });
    return () => sub.remove();
  }, [pause]);

  return {
    ms,
    running,
    finished: !stopwatch && ms <= 0,
    pausedByBackground,
    pause,
    resume,
    addTime,
    restart,
  };
}

export function formatClock(ms: number, roundUp = true): string {
  const total = roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
