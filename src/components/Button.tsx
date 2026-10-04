import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { playSound } from '../audio/sound';
import { haptic, type HapticKind } from '../haptics';
import { RADIUS, TOUCH, usePalette } from '../theme';
import { useReducedMotion } from '../theme/motion';
import { useGuardedCallback } from '../utils/useGuardedCallback';
import { AppText } from './AppText';
import { useAnimatedValue } from '../hooks/useAnimatedValue';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg' | 'xl';
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  /** Extra line under the label. */
  hint?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  haptics?: HapticKind | false;
  sound?: boolean;
  /** Repeated taps inside this window are ignored. */
  cooldownMs?: number;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  disabled,
  hint,
  style,
  accessibilityHint,
  haptics = 'tap',
  sound = true,
  cooldownMs = 450,
  testID,
}: Props) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const scale = useAnimatedValue(1);

  const handle = useGuardedCallback(() => {
    if (disabled) return;
    if (haptics) haptic(haptics);
    if (sound) playSound('click');
    onPress?.();
  }, cooldownMs);

  const bg = {
    primary: p.primary,
    secondary: p.surfaceHigh,
    ghost: 'transparent',
    danger: p.danger,
    success: p.success,
  }[variant];
  const fg = variant === 'secondary' || variant === 'ghost' ? p.text : '#FFFFFF';
  const height = { md: TOUCH, lg: 58, xl: 72 }[size];

  const animate = (to: number) => {
    if (reduced) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        testID={testID}
        onPress={handle}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={hint ? `${label}. ${hint}` : label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!disabled }}
        android_ripple={{ color: '#FFFFFF22', borderless: false }}
        style={[
          styles.base,
          {
            minHeight: height,
            backgroundColor: bg,
            borderColor: variant === 'ghost' ? p.border : 'transparent',
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={size === 'xl' ? 26 : 20} color={fg} /> : null}
          <View style={styles.labels}>
            <AppText
              variant={size === 'xl' ? 'title' : 'heading'}
              style={{ color: fg }}
              align="center"
              numberOfLines={2}
            >
              {label}
            </AppText>
            {hint ? (
              <AppText variant="caption" style={{ color: fg, opacity: 0.85 }} align="center" numberOfLines={2}>
                {hint}
              </AppText>
            ) : null}
          </View>
          {iconRight ? <Ionicons name={iconRight} size={20} color={fg} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  labels: { flexShrink: 1, alignItems: 'center' },
});
