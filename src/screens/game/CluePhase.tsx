import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { FadeIn, PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Card } from '../../components/controls';
import type { GameState } from '../../game/types';
import { haptic } from '../../haptics';
import { useCountdown } from '../../hooks/useCountdown';
import { useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { TimerDisplay } from './TimerDisplay';
import { clueSeconds, twistText } from './twists';

export function TwistBanner({ state }: { state: GameState }) {
  const t = useT();
  const mods = state.round?.setup.modifiers ?? [];
  if (mods.length === 0) return null;
  return (
    <Card tone="warning" style={styles.twists}>
      <AppText variant="label" tone="warning">
        🌀 {t('complete.twists')}
      </AppText>
      {mods.map((m) => (
        <AppText key={m} variant="bodyStrong">
          • {twistText(m, state, t)}
        </AppText>
      ))}
    </Card>
  );
}

/** REVEAL_COMPLETE */
export function RevealCompletePhase({ state }: { state: GameState }) {
  const t = useT();
  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <PopIn>
          <AppText style={styles.bigEmoji}>🤫</AppText>
        </PopIn>
        <AppText variant="display" align="center" accessibilityRole="header">
          {t('complete.title')}
        </AppText>
        <AppText variant="body" tone="muted" align="center">
          {t('complete.body')}
        </AppText>
        <TwistBanner state={state} />
      </View>
      <Button
        label={t('complete.start')}
        icon="chatbubbles"
        size="lg"
        onPress={() => dispatch({ type: 'START_CLUES' })}
        testID="clues-start"
      />
    </View>
  );
}

/** CLUE_PHASE */
export function CluePhase({ state, onPeek }: { state: GameState; onPeek?: () => void }) {
  const t = useT();
  const p = usePalette();
  const round = state.round!;
  const order = round.clueOrder;
  const idx = round.clueIndex;
  const allDone = idx >= order.length;
  const current = state.players.find((pl) => pl.id === order[idx]);
  const seconds = clueSeconds(state);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <AppText variant="label" tone="muted" align="center">
          {round.clueRound > 1 ? t('clue.roundN', { round: round.clueRound }) : t('clue.title')}
        </AppText>
        {!allDone ? <TwistBanner state={state} /> : null}
      </View>

      <View style={styles.center}>
        {allDone ? (
          <FadeIn style={styles.centerInner}>
            <AppText style={styles.bigEmoji}>✅</AppText>
            <AppText variant="display" align="center">
              {t('clue.allDone')}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              {t('clue.allDoneBody')}
            </AppText>
          </FadeIn>
        ) : current ? (
          <FadeIn key={`${round.clueRound}:${idx}`} style={styles.centerInner}>
            <AppText
              variant="hero"
              align="center"
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              accessibilityRole="header"
              testID="clue-current"
            >
              {current.name}
            </AppText>
            <AppText variant="title" tone="muted" align="center">
              {t('clue.giveClue')}
            </AppText>
            {seconds > 0 ? <ClueTimer key={`${round.clueRound}:${idx}`} seconds={seconds} /> : null}
          </FadeIn>
        ) : null}
      </View>

      <View style={styles.orderWrap} accessibilityLabel={t('clue.order')}>
        {order.map((id, i) => {
          const pl = state.players.find((x) => x.id === id);
          const done = i < idx;
          const now = i === idx;
          return (
            <View
              key={id}
              style={[
                styles.chip,
                {
                  backgroundColor: now ? p.primary : done ? p.successSoft : p.surfaceHigh,
                  borderColor: now ? p.primary : 'transparent',
                },
              ]}
            >
              {done ? <Ionicons name="checkmark" size={14} color={p.success} /> : null}
              <AppText
                variant="caption"
                style={{ color: now ? '#FFFFFF' : p.textMuted, fontWeight: '700' }}
                numberOfLines={1}
              >
                {pl?.name}
              </AppText>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        {allDone ? (
          <>
            <Button
              label={t('clue.startDiscussion')}
              icon="people"
              onPress={() => dispatch({ type: 'START_DISCUSSION' })}
              testID="clue-discuss"
            />
            <Button
              label={t('clue.anotherRound')}
              variant="secondary"
              size="md"
              icon="refresh"
              onPress={() => dispatch({ type: 'ANOTHER_CLUE_ROUND' })}
              testID="clue-another"
            />
          </>
        ) : (
          <Button
            label={idx === order.length - 1 ? t('clue.done') : t('clue.next')}
            iconRight="arrow-forward"
            onPress={() => dispatch({ type: 'NEXT_CLUE', index: idx })}
            cooldownMs={500}
            testID="clue-next"
          />
        )}
        {onPeek ? (
          <Button
            label={t('peek.button')}
            variant="ghost"
            size="md"
            icon="eye-outline"
            onPress={onPeek}
            haptics={false}
          />
        ) : null}
      </View>
    </View>
  );
}

function ClueTimer({ seconds }: { seconds: number }) {
  const t = useT();
  const c = useCountdown(seconds * 1000);
  const warned = useRef(false);
  const buzzed = useRef(false);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    const s = Math.ceil(c.ms / 1000);
    if (c.running && s <= 3 && s > 0 && lastTick.current !== s) {
      lastTick.current = s;
      playSound('tick');
    }
    if (c.running && s <= 5 && !warned.current) {
      warned.current = true;
      haptic('warning');
    }
    if (c.finished && !buzzed.current) {
      buzzed.current = true;
      playSound('buzz');
      haptic('error');
    }
  }, [c.ms, c.running, c.finished]);

  return (
    <View style={styles.timer}>
      {c.finished ? (
        <AppText variant="title" tone="warning" align="center" accessibilityLiveRegion="assertive">
          ⏰ {t('clue.timeUp')}
        </AppText>
      ) : (
        <TimerDisplay ms={c.ms} totalMs={seconds * 1000} compact />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: SPACE.md, gap: SPACE.md },
  top: { gap: SPACE.sm },
  center: { flex: 1, justifyContent: 'center' },
  centerInner: { alignItems: 'center', gap: SPACE.sm },
  bigEmoji: { fontSize: 64, lineHeight: 76, textAlign: 'center' },
  twists: { gap: 4, marginTop: SPACE.sm },
  orderWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    maxWidth: 160,
  },
  actions: { gap: SPACE.sm },
  timer: { width: '100%', maxWidth: 320, marginTop: SPACE.md },
});
