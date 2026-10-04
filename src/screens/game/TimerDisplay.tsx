import React, { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { formatClock } from '../../hooks/useCountdown';
import { RADIUS, usePalette } from '../../theme';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

/** Big readable clock with a progress bar. Turns warm (not alarming) in the last 10 s. */
export function TimerDisplay({
  ms,
  totalMs,
  label,
  compact,
}: {
  ms: number;
  totalMs: number;
  label?: string;
  compact?: boolean;
}) {
  const p = usePalette();
  const stopwatch = totalMs <= 0;
  const fraction = stopwatch ? 1 : Math.max(0, Math.min(1, ms / totalMs));
  const warn = !stopwatch && ms <= 10_000;
  const width = useAnimatedValue(fraction);

  useEffect(() => {
    Animated.timing(width, { toValue: fraction, duration: 240, useNativeDriver: false }).start();
  }, [fraction, width]);

  const color = warn ? p.warning : p.scheme === 'dark' ? '#B9A6FF' : p.primary;
  const clock = formatClock(ms, !stopwatch);
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={label ? `${label} ${clock}` : clock}
    >
      {label ? (
        <AppText variant="label" tone="muted" align="center">
          {label}
        </AppText>
      ) : null}
      <AppText
        variant={compact ? 'display' : 'hero'}
        align="center"
        style={[{ color, fontVariant: ['tabular-nums'] }, !compact && styles.big]}
      >
        {clock}
      </AppText>
      {!stopwatch ? (
        <View style={[styles.track, { backgroundColor: p.surfaceHigh }]}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: color,
                width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'stretch', gap: 6 },
  big: { fontSize: 72, lineHeight: 80 },
  track: { height: 10, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
});
