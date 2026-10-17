import React, { useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Card } from '../../components/controls';
import { eliminationsLeft, getNextStep, huntedRemaining } from '../../game/engine/outcome';
import type { GameState } from '../../game/types';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { useReducedMotion } from '../../theme/motion';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import { HuntActions } from './EliminationPhase';

/**
 * VOTE_RESULT: drumroll → the verdict ("X is voted out!", TIE or "Nobody is out") → every
 * candidate's votes (players nobody voted for share one line) → the next step, pinned.
 */
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

  // Players with votes get a bar (stable sort keeps seating order on ties); the rest share one line.
  const rows = Object.entries(outcome.tally.counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const noVotes = Object.entries(outcome.tally.counts)
    .filter(([, n]) => n === 0)
    .map(([id]) => nameOf(id));
  const max = Math.max(1, outcome.tally.maxVotes);
  const showAbstained = state.config.allowAbstain || outcome.tally.abstained > 0;
  const step = getNextStep(state);
  const round = state.round!;
  const names = (ids: readonly string[]) => ids.map(nameOf).join(' & ');
  // Pointed at: players going out, or tied for the last place(s).
  const marked = new Set([...outcome.eliminated, ...outcome.alreadyOut, ...(outcome.needsRevote ? outcome.tied : [])]);

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
      {outcome.needsRevote ? (
        <PopIn style={styles.verdict}>
          <AppText variant="hero" align="center" tone="warning">
            {t('result.tie')}
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            {outcome.revotePicks > 1
              ? t('result.tieBodyMany', { names: names(outcome.tied), count: outcome.revotePicks })
              : t('result.tieBody', { names: names(outcome.tied) })}
          </AppText>
          {outcome.alreadyOut.length > 0 ? (
            <AppText variant="bodyStrong" align="center" testID="vote-already-out">
              {t('result.alreadyOut_other', { names: names(outcome.alreadyOut), count: outcome.alreadyOut.length })}
            </AppText>
          ) : null}
        </PopIn>
      ) : outcome.nobodyOut ? (
        <PopIn style={styles.verdict}>
          <AppText variant="display" align="center" accessibilityLiveRegion="assertive" testID="vote-nobody">
            {t('result.nobodyOut')}
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            {t('result.nobodyOutBody')}
          </AppText>
          {step.kind === 'continue' ? (
            <Card tone="danger" style={styles.randomTie}>
              <AppText variant="bodyStrong" align="center">
                {t('elim.stillHiding', {
                  hidden:
                    state.config.mode === 'undercover'
                      ? t('common.undercovers_other', { count: huntedRemaining(round).length })
                      : t('common.imposters_other', { count: huntedRemaining(round).length }),
                  votes: t('discussion.votesLeft_other', { count: eliminationsLeft(round) }),
                })}
              </AppText>
            </Card>
          ) : null}
        </PopIn>
      ) : outcome.eliminated.length > 0 ? (
        <PopIn style={styles.verdict}>
          {outcome.tieBrokenRandomly ? (
            <Card tone="warning" style={styles.randomTie}>
              <AppText variant="bodyStrong" align="center">
                {t('result.randomTie')}
              </AppText>
            </Card>
          ) : null}
          <AppText variant="display" align="center" accessibilityLiveRegion="assertive" testID="vote-out">
            {outcome.eliminated.length === 1
              ? t('result.out', { name: nameOf(outcome.eliminated[0]!) })
              : t('result.outMany', { names: names(outcome.eliminated) })}
          </AppText>
          {outcome.unfilled > 0 ? (
            <AppText variant="body" tone="muted" align="center">
              {t('result.unfilled_other', { count: outcome.unfilled })}
            </AppText>
          ) : null}
        </PopIn>
      ) : null}

      <ScrollView style={styles.listScroll} contentContainerStyle={styles.bars}>
        {rows.map(([id, n], i) => (
          <TallyBar
            key={id}
            name={nameOf(id)}
            count={n}
            fraction={n / max}
            leader={marked.has(id)}
            delay={i * 120}
            label={t('result.votes_other', { count: n })}
          />
        ))}
        {noVotes.length > 0 ? (
          <AppText variant="caption" tone="muted" testID="vote-none">
            {t('result.noVotes', { names: noVotes.join(', ') })}
          </AppText>
        ) : null}
        {showAbstained ? (
          <AppText variant="caption" tone="muted" testID="vote-abstained">
            {t('result.abstained_other', { count: outcome.tally.abstained })}
          </AppText>
        ) : null}
      </ScrollView>

      {outcome.needsRevote ? (
        <Button
          label={t('result.revote')}
          icon="refresh"
          onPress={() => dispatch({ type: 'START_REVOTE' })}
          testID="vote-revote"
        />
      ) : outcome.nobodyOut ? (
        <View style={styles.actions}>
          {step.kind === 'result' ? (
            <Button
              label={t('elim.seeResults')}
              icon="trophy"
              size="lg"
              onPress={() => dispatch({ type: 'FINISH_ROUND' })}
              testID="vote-results"
            />
          ) : null}
          {step.kind === 'continue' ? <HuntActions state={state} /> : null}
        </View>
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
  const none = count === 0;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(w, { toValue: fraction, duration: 500, delay, useNativeDriver: false }).start();
  }, [w, fraction, delay, reduced]);
  return (
    <View style={styles.barRow} accessible accessibilityLabel={`${name}: ${label}`}>
      <View style={styles.barHead}>
        <AppText variant="bodyStrong" tone={none ? 'muted' : 'default'} numberOfLines={1} style={styles.flex}>
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
  root: { flex: 1, minHeight: 0, paddingVertical: SPACE.md, gap: SPACE.lg },
  listScroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.lg },
  drum: { fontSize: 80, lineHeight: 96 },
  bars: { gap: SPACE.md },
  barRow: { gap: 6 },
  barHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  track: { height: 14, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
  verdict: { gap: SPACE.sm, alignItems: 'center' },
  randomTie: { paddingVertical: SPACE.sm },
  actions: { gap: SPACE.sm },
  flex: { flex: 1 },
});
