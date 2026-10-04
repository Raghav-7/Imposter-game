import React, { useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Pill } from '../../components/controls';
import { MODES } from '../../game/modes';
import type { GameState } from '../../game/types';
import { useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { useReducedMotion } from '../../theme/motion';
import { TIMING } from '../../utils/timing';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

const CARD_COUNT = 5;

/** WORD_GENERATED: a short shuffle animation, then the reveal starts automatically. */
export function DealPhase({ state }: { state: GameState }) {
  const t = useT();
  const p = usePalette();
  const reduced = useReducedMotion();
  const spin = useAnimatedValue(0);
  const roundId = state.round?.id;

  useEffect(() => {
    playSound('suspense');
    const anim = Animated.timing(spin, {
      toValue: 1,
      duration: reduced ? 0 : 1500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    const id = setTimeout(
      () => dispatch({ type: 'BEGIN_REVEAL' }),
      reduced ? Math.min(500, TIMING.dealMs) : TIMING.dealMs,
    );
    return () => {
      anim.stop();
      clearTimeout(id);
    };
  }, [spin, reduced, roundId]);

  const mode = MODES[state.config.mode];
  return (
    <View style={styles.root}>
      <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: CARD_COUNT }, (_, i) => {
          const offset = i - (CARD_COUNT - 1) / 2;
          return (
            <Animated.View
              key={i}
              style={[
                styles.card,
                {
                  backgroundColor: i % 2 ? p.primary : p.surfaceHigh,
                  borderColor: p.border,
                  transform: [
                    {
                      translateX: spin.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, offset * 46, offset * 18],
                      }),
                    },
                    {
                      rotate: spin.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: ['0deg', `${offset * 16}deg`, `${offset * 6}deg`],
                      }),
                    },
                  ],
                },
              ]}
            >
              <AppText style={styles.cardMark}>?</AppText>
            </Animated.View>
          );
        })}
      </View>
      <AppText variant="display" align="center" accessibilityLiveRegion="polite">
        {t('deal.title')}
      </AppText>
      <AppText variant="body" tone="muted" align="center">
        {t('deal.subtitle')}
      </AppText>
      <View style={styles.pills}>
        <Pill label={`${mode.emoji} ${t(`mode.${mode.id}.name`)}`} tone="primary" />
        <Pill label={t('common.players_other', { count: state.players.length })} />
      </View>
      <Button
        label={t('common.continue')}
        variant="ghost"
        size="md"
        onPress={() => dispatch({ type: 'BEGIN_REVEAL' })}
        style={styles.skip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.md },
  stage: { height: 200, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.xl },
  card: {
    position: 'absolute',
    width: 96,
    height: 136,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMark: { fontSize: 40, lineHeight: 48, color: '#FFFFFF', fontWeight: '900' },
  pills: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  skip: { marginTop: SPACE.xl },
});
