import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Card } from '../../components/controls';
import type { GameState } from '../../game/types';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { useReducedMotion } from '../../theme/motion';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

/** VOTE_RESULT: drumroll → tally bars → "X is voted out!" or TIE. */
export function VoteResultPhase({ state }: { state: GameState }) {
  const t = useT();
  const reduced = useReducedMotion();
  const outcome = state.round!.lastVote!;
  const [revealed, setRevealed] = useState(reduced);
  const nameOf = (id: string) => state.players.find((pl) => pl.id === id)?.name ?? '?';

  useEffect(() => {
    if (reduced) return;
    playSound('suspense');
    const id = setTimeout(() => {
      setRevealed(true);
      haptic('reveal');
    }, 1700);
    return () => clearTimeout(id);
  }, [reduced]);

  const rows = Object.entries(outcome.tally.counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, outcome.tally.maxVotes);

  if (!revealed) {
    return (
      <View style={styles.center}>
        <PopIn>
          <AppText style={styles.drum}>🥁</AppText>
        </PopIn>
        <AppText variant="display" align="center">
          {t('result.drumroll')}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.bars}>
        {rows.map(([id, n], i) => (
          <TallyBar
            key={id}
            name={nameOf(id)}
            count={n}
            fraction={n / max}
            leader={outcome.tally.leaders.includes(id)}
            delay={i * 120}
            label={t('result.votes_other', { count: n })}
          />
        ))}
      </View>

      {outcome.needsRevote ? (
        <PopIn style={styles.verdict}>
          <AppText variant="hero" align="center" tone="warning">
            {t('result.tie')}
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            {t('result.tieBody', { names: outcome.tally.leaders.map(nameOf).join(' & ') })}
          </AppText>
        </PopIn>
      ) : outcome.eliminated ? (
        <PopIn style={styles.verdict}>
          {outcome.tieBrokenRandomly ? (
            <Card tone="warning" style={styles.randomTie}>
              <AppText variant="bodyStrong" align="center">
                {t('result.randomTie')}
              </AppText>
            </Card>
          ) : null}
          <AppText variant="display" align="center" accessibilityLiveRegion="assertive" testID="vote-out">
            {t('result.out', { name: nameOf(outcome.eliminated) })}
          </AppText>
        </PopIn>
      ) : null}

      {outcome.needsRevote ? (
        <Button
          label={t('result.revote')}
          icon="refresh"
          onPress={() => dispatch({ type: 'START_REVOTE' })}
          testID="vote-revote"
        />
      ) : (
        <Button
          label={t('result.revealRole')}
          icon="eye"
          variant="danger"
          size="lg"
          haptics="reveal"
          onPress={() => dispatch({ type: 'CONFIRM_ELIMINATION' })}
          testID="vote-reveal-role"
        />
      )}
    </View>
  );
}

function TallyBar({
  name,
  count,
  fraction,
  leader,
  delay,
  label,
}: {
  name: string;
  count: number;
  fraction: number;
  leader: boolean;
  delay: number;
  label: string;
}) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const w = useAnimatedValue(reduced ? fraction : 0);
  useEffect(() => {
    if (reduced) return;
    Animated.timing(w, { toValue: fraction, duration: 500, delay, useNativeDriver: false }).start();
  }, [w, fraction, delay, reduced]);
  return (
    <View style={styles.barRow} accessible accessibilityLabel={`${name}: ${label}`}>
      <View style={styles.barHead}>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
          {leader ? '👉 ' : ''}
          {name}
        </AppText>
        <AppText variant="bodyStrong" tone={leader ? 'danger' : 'muted'}>
          {count}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: p.surfaceHigh }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: leader ? p.danger : p.primary,
              width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: SPACE.md, gap: SPACE.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.lg },
  drum: { fontSize: 80, lineHeight: 96 },
  bars: { gap: SPACE.md },
  barRow: { gap: 6 },
  barHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  track: { height: 14, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
  verdict: { gap: SPACE.sm, alignItems: 'center' },
  randomTie: { paddingVertical: SPACE.sm },
  flex: { flex: 1 },
});
