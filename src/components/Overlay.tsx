import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '../haptics';
import { RADIUS, SPACE, usePalette } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { useAnimatedValue } from '../hooks/useAnimatedValue';

/**
 * App-wide confirm dialogs and toasts, rendered by <OverlayHost/> at the root.
 * `confirm()` resolves true/false; dialogs can never be stacked.
 */
interface DialogAction {
  label: string;
  value: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

interface DialogRequest {
  id: number;
  title: string;
  body?: string;
  actions: DialogAction[];
  dismissValue: string;
  resolve: (value: string) => void;
}

interface OverlayState {
  dialog: DialogRequest | null;
  toast: { id: number; message: string } | null;
}

let overlay: OverlayState = { dialog: null, toast: null };
const listeners = new Set<() => void>();
let nextId = 1;
const setOverlay = (patch: Partial<OverlayState>) => {
  overlay = { ...overlay, ...patch };
  listeners.forEach((l) => l());
};

/** Shows a dialog with custom actions; resolves with the chosen action's value. */
export function choose(
  title: string,
  body: string | undefined,
  actions: DialogAction[],
  dismissValue: string,
): Promise<string> {
  // Close any open dialog first (resolving it as dismissed).
  overlay.dialog?.resolve(overlay.dialog.dismissValue);
  return new Promise((resolve) => {
    const id = nextId++;
    setOverlay({
      dialog: {
        id,
        title,
        body,
        actions,
        dismissValue,
        resolve: (value) => {
          if (overlay.dialog?.id === id) setOverlay({ dialog: null });
          resolve(value);
        },
      },
    });
  });
}

export async function confirm(opts: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  haptic('warning');
  const v = await choose(
    opts.title,
    opts.body,
    [
      { label: opts.confirmLabel, value: 'yes', variant: opts.destructive ? 'danger' : 'primary' },
      { label: opts.cancelLabel, value: 'no', variant: 'secondary' },
    ],
    'no',
  );
  return v === 'yes';
}

export function toast(message: string) {
  setOverlay({ toast: { id: nextId++, message } });
}

/** Closes any open dialog (e.g. when the app is backgrounded). */
export function dismissOverlays() {
  overlay.dialog?.resolve(overlay.dialog.dismissValue);
}

function useOverlay() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => overlay,
    () => overlay,
  );
}

export function OverlayHost() {
  const { dialog, toast: currentToast } = useOverlay();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const opacity = useAnimatedValue(0);
  // Id of the toast whose animation has finished; anything newer is still showing.
  const [doneId, setDoneId] = useState<number | null>(null);
  const shownToast = currentToast && currentToast.id !== doneId ? currentToast.message : null;

  useEffect(() => {
    if (!currentToast) return;
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) setDoneId(currentToast.id);
    });
    return () => anim.stop();
  }, [currentToast, opacity]);

  return (
    <>
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => dialog?.resolve(dialog.dismissValue)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: p.overlay }]}
          onPress={() => dialog?.resolve(dialog.dismissValue)}
          accessibilityLabel={dialog?.title}
        >
          <Pressable
            style={[
              styles.dialog,
              { backgroundColor: p.scheme === 'dark' ? '#1C1730' : '#FFFFFF', borderColor: p.border },
            ]}
          >
            <AppText variant="title" accessibilityRole="header">
              {dialog?.title}
            </AppText>
            {dialog?.body ? (
              <AppText variant="body" tone="muted" style={styles.body}>
                {dialog.body}
              </AppText>
            ) : null}
            <View style={styles.actions}>
              {dialog?.actions.map((a) => (
                <Button
                  key={a.value}
                  label={a.label}
                  variant={a.variant ?? 'secondary'}
                  size="md"
                  onPress={() => dialog.resolve(a.value)}
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {shownToast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            { opacity, bottom: insets.bottom + 90, backgroundColor: p.scheme === 'dark' ? '#2A2340' : '#16111F' },
          ]}
          accessibilityLiveRegion="polite"
        >
          <AppText variant="bodyStrong" style={{ color: '#FFFFFF' }} align="center">
            {shownToast}
          </AppText>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: SPACE.xl },
  dialog: {
    borderRadius: RADIUS.xl,
    padding: SPACE.xl,
    borderWidth: 1,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  body: { marginTop: SPACE.sm },
  actions: { marginTop: SPACE.xl, gap: SPACE.sm },
  toast: {
    position: 'absolute',
    left: SPACE.xl,
    right: SPACE.xl,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    alignSelf: 'center',
    maxWidth: 480,
  },
});
