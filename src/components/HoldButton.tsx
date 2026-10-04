import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '../haptics';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { RADIUS, usePalette } from '../theme';
import { TIMING } from '../utils/timing';
import { AppText } from './AppText';

/**
 * Press-and-hold button: fires only after being held for TIMING.holdRevealMs,
 * so a stray tap (e.g. when unlocking the phone) can't trigger it. Screen
 * readers get a normal "activate" action because holding isn't possible there.
 */
export function HoldButton({
  label,
  holdingLabel,
  onComplete,
  icon = 'eye',
  testID,
}: {
  label: string;
  holdingLabel: string;
  onComplete: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  const p = usePalette();
  const progress = useAnimatedValue(0);
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    progress.stopAnimation();
    progress.setValue(0);
    setHolding(false);
  };

  const finish = () => {
    if (done.current) return;
    done.current = true;
    haptic('reveal');
    onComplete();
  };

  const start = () => {
    if (done.current) return;
    if (TIMING.holdRevealMs <= 0) {
      finish();
      return;
    }
    haptic('tap');
    setHolding(true);
    Animated.timing(progress, {
      toValue: 1,
      duration: TIMING.holdRevealMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    timer.current = setTimeout(finish, TIMING.holdRevealMs);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Pressable
      onPressIn={start}
      onPressOut={() => !done.current && cancel()}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && finish()}
      testID={testID}
      style={[styles.root, { backgroundColor: p.surfaceHigh, borderColor: p.primary }]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: p.primary,
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
      <View style={styles.row}>
        <Ionicons name={icon} size={24} color={p.text} />
        <AppText variant="title" style={styles.label} numberOfLines={2}>
          {holding ? holdingLabel : label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 72, borderRadius: RADIUS.lg, borderWidth: 2, overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  label: { textAlign: 'center', flexShrink: 1 },
});
