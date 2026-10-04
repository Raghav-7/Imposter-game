import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { settingsStore } from '../state/settings';

export type HapticKind = 'tap' | 'select' | 'confirm' | 'warning' | 'reveal' | 'success' | 'error';

/** Subtle, optional haptics. No-ops when disabled, on web, or if the device lacks a motor. */
export function haptic(kind: HapticKind = 'tap') {
  if (!settingsStore.get().haptics || Platform.OS === 'web') return;
  let p: Promise<void>;
  switch (kind) {
    case 'select':
      p = Haptics.selectionAsync();
      break;
    case 'confirm':
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'reveal':
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
    case 'warning':
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'success':
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'error':
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
    default:
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  p.catch(() => undefined);
}
