import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { getSecretView } from '../../game/engine/secrets';
import type { GameState } from '../../game/types';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { useSettings } from '../../state/settings';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { useReducedMotion } from '../../theme/motion';
import { TIMING } from '../../utils/timing';
import { useArmDelay } from '../../utils/useGuardedCallback';
import { PassPhoneGate } from './PassPhoneGate';
import { RoleCard } from './RoleCard';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

/** ROLE_REVEAL_INTRO → "pass the phone"; ROLE_REVEAL → the private card. */
export function RevealPhase({ state }: { state: GameState }) {
  const t = useT();
  const round = state.round!;
  const index = round.revealIndex;
  const player = state.players[index];
  if (!player) return null;

  if (state.phase === 'ROLE_REVEAL_INTRO') {
    return (
      <PassPhoneGate
        heading={t('reveal.passTo')}
        name={player.name}
        progress={t('reveal.progress', { current: index + 1, total: state.players.length })}
        note={t('reveal.lookAway')}
        buttonLabel={t('reveal.ready', { name: player.name })}
        resetKey={`${round.id}:${index}`}
        onReady={() => dispatch({ type: 'SHOW_SECRET', index })}
        testID="reveal-gate"
      />
    );
  }
  return <SecretStep state={state} index={index} />;
}

function SecretStep({ state, index }: { state: GameState; index: number }) {
  const t = useT();
  const p = usePalette();
  const { revealStyle } = useSettings();
  const reduced = useReducedMotion();
  const player = state.players[index]!;
  const isLast = index === state.players.length - 1;
  const [holding, setHolding] = useState(false);
  const [seenOnce, setSeenOnce] = useState(revealStyle === 'tap');
  // The "hide" button can't be hit by the same tap that revealed the card.
  const armed = useArmDelay(TIMING.hideArmMs, index);
  const flip = useAnimatedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (revealStyle !== 'tap') return;
    playSound('reveal');
    haptic('reveal');
    if (reduced) return;
    Animated.timing(flip, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [flip, reduced, revealStyle]);

  const done = () => dispatch({ type: 'SECRET_SEEN', index });

  // The secret is computed at render time only while visible; never stored.
  const visible = revealStyle === 'tap' || holding;
  const view = visible ? getSecretView(state, player.id) : null;

  return (
    <View style={styles.root}>
      <AppText variant="label" tone="muted" align="center">
        {player.name}
      </AppText>

      {revealStyle === 'tap' ? (
        <Animated.View
          style={{
            opacity: flip,
            transform: [
              { perspective: 800 },
              { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['80deg', '0deg'] }) },
              { scale: flip.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
          }}
        >
          {view ? <RoleCard view={view} /> : null}
        </Animated.View>
      ) : (
        <Pressable
          onPressIn={() => {
            setHolding(true);
            setSeenOnce(true);
            haptic('reveal');
          }}
          onPressOut={() => setHolding(false)}
          accessibilityRole="button"
          accessibilityLabel={t('reveal.holdToReveal')}
          accessibilityHint={t('reveal.holdHint')}
          testID="reveal-hold"
          style={styles.holdArea}
        >
          {view ? (
            <RoleCard view={view} />
          ) : (
            <View style={[styles.cover, { backgroundColor: p.surfaceHigh, borderColor: p.primary + '66' }]}>
              <AppText style={styles.coverEmoji}>👆</AppText>
              <AppText variant="title" align="center">
                {t('reveal.holdToReveal')}
              </AppText>
              <AppText variant="caption" tone="muted" align="center">
                {t('reveal.holdHint')}
              </AppText>
            </View>
          )}
        </Pressable>
      )}

      <Button
        label={isLast ? t('reveal.last') : revealStyle === 'tap' ? t('reveal.hideAndPass') : t('reveal.gotIt')}
        icon="eye-off"
        variant="secondary"
        size="lg"
        disabled={!armed || !seenOnce || holding}
        onPress={done}
        cooldownMs={900}
        testID="reveal-hide"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: SPACE.lg, gap: SPACE.lg },
  holdArea: { flex: 1, justifyContent: 'center' },
  cover: {
    minHeight: 340,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
    padding: SPACE.xl,
  },
  coverEmoji: { fontSize: 56, lineHeight: 66 },
});
