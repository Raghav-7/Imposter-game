import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useSettings } from '../state/settings';

/** OS "reduce motion" flag, kept in a tiny external store. */
let systemReduced = false;
const listeners = new Set<() => void>();
let initialised = false;

function setSystemReduced(v: boolean) {
  if (v === systemReduced) return;
  systemReduced = v;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialised) {
    initialised = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSystemReduced)
      .catch(() => undefined);
    try {
      AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduced);
    } catch {
      // Not supported on this platform — keep the default.
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

const getSystemReduced = () => systemReduced;

/** True when animations should be minimised (user setting or OS accessibility setting). */
export function useReducedMotion(): boolean {
  const { motion } = useSettings();
  const system = useSyncExternalStore(subscribe, getSystemReduced, getSystemReduced);
  if (motion === 'reduced') return true;
  if (motion === 'full') return false;
  return system;
}
