import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Card } from '../../components/controls';
import { HoldButton } from '../../components/HoldButton';
import { eliminationsLeft, huntedRemaining } from '../../game/engine/outcome';
import type { GameState } from '../../game/types';
import { haptic } from '../../haptics';
import { useCountdown } from '../../hooks/useCountdown';
import { useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { SPACE } from '../../theme';
import { TimerDisplay } from './TimerDisplay';
import { OutLoudButton, useVoteSize, VoteSizePicker } from './VoteStart';

export function DiscussionPhase({ state, onPeek }: { state: GameState; onPeek?: () => void }) {
  const t = useT();
  const round = state.round!;
  const totalMs = state.config.discussionTimerSec * 1000;
  const c = useCountdown(totalMs);
  const warned = useRef(false);
  const ended = useRef(false);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    if (totalMs <= 0) return;
    const s = Math.ceil(c.ms / 1000);
    if (c.running && s <= 10 && !warned.current) {
      warned.current = true;
      haptic('warning');
    }
    if (c.running && s <= 5 && s > 0 && lastTick.current !== s) {
      lastTick.current = s;
      playSound('tick');
    }
    if (c.finished && !ended.current) {
      ended.current = true;
      playSound('buzz');
      haptic('error');
    }
  }, [c.ms, c.running, c.finished, totalMs]);

  const hidden = huntedRemaining(round).length;
  const votes = eliminationsLeft(round);
  const voting = state.config.voting;
  const { size, setSize, max } = useVoteSize(round);
  // With voting off there are no on-phone votes to count.
  const showHunt = voting && round.eliminationsAllowed > 1;
  const peekers = round.peeks.map((id) => state.players.find((p) => p.id === id)?.name).filter((n): n is string => !!n);

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <PopIn>
          <AppText variant="hero" align="center" accessibilityRole="header">
            {t('discussion.title')}
          </AppText>
        </PopIn>
        <AppText variant="title" tone="muted" align="center">
          {t('discussion.subtitle')}
        </AppText>
        {showHunt ? (
          <Card tone="danger" style={styles.hunt}>
            <AppText variant="bodyStrong" align="center">
              {t('discussion.hunt', {
                hidden:
                  state.config.mode === 'undercover'
                    ? t('common.undercovers_other', { count: hidden })
                    : t('common.imposters_other', { count: hidden }),
                votes: t('discussion.votesLeft_other', { count: votes }),
              })}
            </AppText>
          </Card>
        ) : null}
        {voting ? <VoteSizePicker size={size} max={max} onChange={setSize} /> : null}
        <View style={styles.timer}>
          {c.finished ? (
            <AppText variant="title" tone="warning" align="center" accessibilityLiveRegion="assertive">
              ⏰ {t('discussion.timeUp')}
            </AppText>
          ) : (
            <TimerDisplay ms={c.ms} totalMs={totalMs} label={totalMs <= 0 ? t('discussion.elapsed') : undefined} />
          )}
          {!c.running && !c.finished ? (
            <AppText variant="caption" tone="warning" align="center">
              {c.pausedByBackground ? t('discussion.pausedBackground') : t('discussion.paused')}
            </AppText>
          ) : null}
        </View>
        {peekers.length > 0 ? (
          <AppText variant="caption" tone="faint" align="center">
            {t('peek.log', { names: peekers.join(', ') })}
          </AppText>
        ) : null}
      </View>

      <View style={styles.actions}>
        {!c.finished ? (
          <View style={styles.row}>
            <Button
              label={c.running ? t('discussion.pause') : t('discussion.resume')}
              icon={c.running ? 'pause' : 'play'}
              variant="secondary"
              size="md"
              style={styles.flex}
              onPress={() => (c.running ? c.pause() : c.resume())}
              cooldownMs={250}
              testID="discussion-pause"
            />
            {totalMs > 0 ? (
              <Button
                label={t('discussion.addTime')}
                icon="add"
                variant="secondary"
                size="md"
                style={styles.flex}
                onPress={() => c.addTime(30_000)}
                cooldownMs={250}
              />
            ) : null}
          </View>
        ) : null}
        {voting ? (
          <Button
            label={t('discussion.vote')}
            icon="hand-left"
            variant={c.finished ? 'primary' : 'danger'}
            onPress={() => dispatch({ type: 'START_VOTING', picks: size })}
            haptics="confirm"
            testID="discussion-vote"
          />
        ) : (
          <>
            <AppText variant="caption" tone="faint" align="center">
              {t('simple.holdHint')}
            </AppText>
            {/* Voting off: the group votes out loud, then holds for the answer. */}
            <HoldButton
              label={t('simple.holdReveal')}
              holdingLabel={t('simple.holding')}
              onComplete={() => dispatch({ type: 'REVEAL_ANSWER' })}
              testID="answer-hold"
            />
          </>
        )}
        {voting ? <OutLoudButton state={state} /> : null}
        {onPeek ? (
          <Button
            label={state.config.mode === 'questions' ? t('peek.buttonQuestion') : t('peek.button')}
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

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: SPACE.md, gap: SPACE.lg },
  center: { flex: 1, justifyContent: 'center', gap: SPACE.md },
  hunt: { paddingVertical: SPACE.sm },
  timer: { gap: SPACE.xs, marginTop: SPACE.md },
  actions: { gap: SPACE.sm },
  row: { flexDirection: 'row', gap: SPACE.sm },
  flex: { flex: 1 },
});
