import { useEffect, useRef } from 'react';

/**
 * A private screen that is open right now (an open ballot or final guess). The game route
 * closes it on hardware back and before the "leave game?" dialog, like it hides a revealed
 * card, so a private pick never stays on screen behind a dialog or for the next person.
 */
let closeOpen: (() => void) | null = null;

/** Registers `close` while `open` is true. */
export function usePrivateScreen(open: boolean, close: () => void) {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const entry = () => latest.current();
    closeOpen = entry;
    return () => {
      if (closeOpen === entry) closeOpen = null;
    };
  }, [open]);
}

/** Closes the open private screen. Returns false if none was open. */
export function closePrivateScreen(): boolean {
  if (!closeOpen) return false;
  const close = closeOpen;
  closeOpen = null;
  close();
  return true;
}
