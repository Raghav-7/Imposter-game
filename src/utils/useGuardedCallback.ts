import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps a handler so rapid repeated taps are ignored for `cooldownMs`.
 * Prevents double navigation, duplicate votes and multiple game starts.
 */
export function useGuardedCallback<A extends unknown[]>(
  fn: ((...args: A) => void) | undefined,
  cooldownMs = 450,
): (...args: A) => void {
  const last = useRef(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  return useCallback(
    (...args: A) => {
      const now = Date.now();
      if (now - last.current < cooldownMs) return;
      last.current = now;
      fnRef.current?.(...args);
    },
    [cooldownMs],
  );
}

/**
 * False for `delayMs` after mount (or after `resetKey` changes), then true.
 * Used so a tap meant for the previous screen can't land on the next one —
 * e.g. a double-tap on "Hide & pass" must never reveal the next player's card.
 */
export function useArmDelay(delayMs: number, resetKey?: unknown): boolean {
  // Remember which key the timer has elapsed for; a new key is unarmed until its own timer fires.
  const [armedFor, setArmedFor] = useState<{ key: unknown } | null>(null);
  useEffect(() => {
    if (delayMs <= 0) return;
    const id = setTimeout(() => setArmedFor({ key: resetKey }), delayMs);
    return () => clearTimeout(id);
  }, [delayMs, resetKey]);
  return delayMs <= 0 || (armedFor !== null && Object.is(armedFor.key, resetKey));
}
