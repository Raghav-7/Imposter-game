import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { FadeIn, Pulse } from '../../components/anim';
import { Button } from '../../components/Button';
import { SPACE, usePalette } from '../../theme';
import { TIMING } from '../../utils/timing';
import { useArmDelay } from '../../utils/useGuardedCallback';

/**
 * "Pass the phone to NAME" screen. Shows no secret information at all; the
 * button only activates after a short delay.
 */
export function PassPhoneGate({
  heading,
  name,
  progress,
  note,
  buttonLabel,
  onReady,
  emoji = '📱',
  resetKey,
  testID,
}: {
  heading: string;
  name: string;
  progress?: string;
  note?: string;
  buttonLabel: string;
  onReady: () => void;
  emoji?: string;
  resetKey?: unknown;
  testID?: string;
}) {
  const p = usePalette();
  const armed = useArmDelay(TIMING.gateArmMs, resetKey ?? name);
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.center}>
        <Pulse>
          <View style={[styles.circle, { backgroundColor: p.primarySoft, borderColor: p.primary + '66' }]}>
            <AppText style={styles.emoji}>{emoji}</AppText>
          </View>
        </Pulse>
        <FadeIn key={String(resetKey ?? name)}>
          <AppText variant="label" tone="muted" align="center">
            {heading}
          </AppText>
          <AppText
            variant="hero"
            align="center"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={styles.name}
            accessibilityRole="header"
          >
            {name}
          </AppText>
          {progress ? (
            <AppText variant="caption" tone="faint" align="center">
              {progress}
            </AppText>
          ) : null}
        </FadeIn>
        {note ? (
          <AppText variant="body" tone="muted" align="center" style={styles.note}>
            {note}
          </AppText>
        ) : null}
      </View>
      <Button
        label={buttonLabel}
        size="xl"
        icon="eye"
        onPress={onReady}
        disabled={!armed}
        haptics="confirm"
        cooldownMs={800}
        testID={testID ? `${testID}-ready` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: SPACE.lg, gap: SPACE.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.lg },
  circle: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 52, lineHeight: 62 },
  name: { marginTop: SPACE.xs, maxWidth: '100%' },
  note: { maxWidth: 340 },
});
