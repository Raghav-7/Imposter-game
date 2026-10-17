import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { Confetti, FadeIn, PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Card } from '../../components/controls';
import { eliminationsLeft, getNextStep, huntedRemaining, lastBatch, type NextStep } from '../../game/engine/outcome';
import { isHunted } from '../../game/roles';
import type { Elimination, GameState, RoleId } from '../../game/types';
import { haptic } from '../../haptics';
import { type TranslationKey, useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { SPACE } from '../../theme';
import { useReducedMotion } from '../../theme/motion';

const ROLE_LINE: Record<RoleId, TranslationKey> = {
  imposter: 'elim.imposter',
  undercover: 'elim.undercover',
  civilian: 'elim.civilian',
  detective: 'elim.detective',
  agent: 'elim.agent',
  jester: 'elim.jester',
};

/** ELIMINATION: dramatic role reveal of the voted-out player(s), then the next step. */
export function EliminationPhase({ state }: { state: GameState }) {
  const batch = lastBatch(state.round!);
  return batch.length > 1 ? <BatchReveal state={state} batch={batch} /> : <SingleReveal state={state} />;
}

/** Several players voted out together: every role at once. */
function BatchReveal({ state, batch }: { state: GameState; batch: Elimination[] }) {
  const t = useT();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced);
  const anyHunted = batch.some((e) => isHunted(e.role));
  const step = getNextStep(state);

  useEffect(() => {
    const reveal = () => {
      playSound(anyHunted || batch.some((e) => e.role === 'jester') ? 'imposter' : 'buzz');
      haptic(anyHunted ? 'success' : 'error');
    };
    if (reduced) {
      reveal();
      return;
    }
    const id = setTimeout(() => {
      setShown(true);
      reveal();
    }, 1200);
    return () => clearTimeout(id);
  }, [reduced, anyHunted, batch]);

  return (
    <View style={styles.root}>
      {shown && anyHunted ? <Confetti emojis={['🎉', '🕵️', '✨', '🎭']} /> : null}
      <View style={styles.center}>
        <AppText variant="title" tone="muted" align="center">
          {t('elim.batchTitle', { count: batch.length })}
        </AppText>
        <View style={styles.batch}>
          {batch.map((e) => {
            const hunted = isHunted(e.role);
            return (
              <View key={e.playerId} style={styles.batchRow} accessible testID={`elim-batch-${e.playerId}`}>
                <AppText variant="heading" numberOfLines={1} style={styles.flex}>
                  {state.players.find((p) => p.id === e.playerId)?.name ?? '?'}
                </AppText>
                <AppText
                  variant="bodyStrong"
                  tone={!shown ? 'faint' : hunted ? 'success' : e.role === 'jester' ? 'warning' : 'danger'}
                >
                  {shown ? t(ROLE_LINE[e.role]) : '❓'}
                </AppText>
              </View>
            );
          })}
        </View>
        {shown ? <StepNotes state={state} step={step} /> : null}
      </View>
      {shown ? <StepActions state={state} step={step} /> : null}
    </View>
  );
}

function SingleReveal({ state }: { state: GameState }) {
  const t = useT();
  const reduced = useReducedMotion();
  const round = state.round!;
  const last = round.eliminations[round.eliminations.length - 1]!;
  const name = state.players.find((p) => p.id === last.playerId)?.name ?? '?';
  const [shown, setShown] = useState(reduced);
  const hunted = isHunted(last.role);
  const step = getNextStep(state);

  useEffect(() => {
    if (reduced) {
      playSound(hunted ? 'imposter' : 'buzz');
      return;
    }
    const id = setTimeout(() => {
      setShown(true);
      playSound(hunted || last.role === 'jester' ? 'imposter' : 'buzz');
      haptic(hunted ? 'success' : 'error');
    }, 1200);
    return () => clearTimeout(id);
  }, [reduced, hunted, last.role]);

  const tone = hunted ? 'success' : last.role === 'jester' ? 'warning' : 'danger';

  return (
    <View style={styles.root}>
      {shown && hunted ? <Confetti emojis={['🎉', '🕵️', '✨', '🎭']} /> : null}
      <View style={styles.center}>
        <FadeIn>
          <AppText variant="title" tone="muted" align="center">
            {t('elim.was', { name })}
          </AppText>
        </FadeIn>
        {shown ? (
          <PopIn style={styles.reveal}>
            <AppText variant="hero" align="center" tone={tone} accessibilityLiveRegion="assertive" testID="elim-role">
              {t(ROLE_LINE[last.role])}
            </AppText>
            {last.role === 'jester' ? (
              <AppText variant="body" tone="muted" align="center">
                {t('elim.jesterBody')}
              </AppText>
            ) : null}
            {!hunted && last.role !== 'jester' ? (
              <AppText variant="body" tone="muted" align="center">
                {t('elim.civilianBody')}
              </AppText>
            ) : null}
            {hunted ? (
              <AppText variant="title" align="center" tone="success">
                {last.role === 'undercover' ? t('elim.foundUndercover') : t('elim.found')}
              </AppText>
            ) : null}
          </PopIn>
        ) : (
          <AppText style={styles.suspense} align="center">
            ❓
          </AppText>
        )}
        {shown ? <StepNotes state={state} step={step} /> : null}
      </View>

      {shown ? <StepActions state={state} step={step} /> : null}
    </View>
  );
}

/** "But they get one final chance…" or "N still hiding · N votes left". */
function StepNotes({ state, step }: { state: GameState; step: NextStep }) {
  const t = useT();
  const round = state.round!;
  if (step.kind === 'guess') {
    return (
      <FadeIn delay={300}>
        <AppText variant="heading" tone="warning" align="center">
          {t('elim.lastChance')}
        </AppText>
      </FadeIn>
    );
  }
  if (step.kind !== 'continue') return null;
  const hiddenCount = huntedRemaining(round).length;
  return (
    <Card tone="danger" style={styles.hunt}>
      <AppText variant="bodyStrong" align="center">
        {t('elim.stillHiding', {
          hidden:
            state.config.mode === 'undercover'
              ? t('common.undercovers_other', { count: hiddenCount })
              : t('common.imposters_other', { count: hiddenCount }),
          votes: t('discussion.votesLeft_other', { count: eliminationsLeft(round) }),
        })}
      </AppText>
    </Card>
  );
}

/** The next step: a caught imposter's final guess, the hunt going on, or the result. */
function StepActions({ state, step }: { state: GameState; step: NextStep }) {
  const t = useT();
  const guesser = step.kind === 'guess' ? state.players.find((p) => p.id === step.playerId)?.name : undefined;
  return (
    <View style={styles.actions}>
      {step.kind === 'guess' ? (
        <Button
          label={t('elim.giveGuess', { name: guesser ?? '?' })}
          icon="help-circle"
          size="lg"
          onPress={() => dispatch({ type: 'START_GUESS' })}
          testID="elim-guess"
        />
      ) : null}
      {step.kind === 'continue' ? <HuntActions state={state} /> : null}
      {step.kind === 'result' ? (
        <Button
          label={t('elim.seeResults')}
          icon="trophy"
          size="lg"
          onPress={() => dispatch({ type: 'FINISH_ROUND' })}
          testID="elim-results"
        />
      ) : null}
    </View>
  );
}

/**
 * The hunt goes on (more hidden players than votes used). Full game: another clue lap or
 * straight to discussion. Words only: back to talking out loud, then vote again.
 */
export function HuntActions({ state }: { state: GameState }) {
  const t = useT();
  if (state.config.playStyle === 'simple') {
    return (
      <Button
        label={t('elim.keepTalking')}
        icon="people"
        onPress={() => dispatch({ type: 'CONTINUE_HUNT', to: 'discussion' })}
        testID="hunt-continue"
      />
    );
  }
  return (
    <>
      <Button
        label={t('elim.discuss')}
        icon="people"
        onPress={() => dispatch({ type: 'CONTINUE_HUNT', to: 'discussion' })}
        testID="elim-discuss"
      />
      <Button
        label={t('elim.moreClues')}
        icon="chatbubbles"
        variant="secondary"
        size="md"
        onPress={() => dispatch({ type: 'CONTINUE_HUNT', to: 'clues' })}
        testID="elim-clues"
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: SPACE.md, gap: SPACE.lg },
  center: { flex: 1, justifyContent: 'center', gap: SPACE.lg },
  reveal: { gap: SPACE.sm, alignItems: 'center' },
  suspense: { fontSize: 88, lineHeight: 104 },
  hunt: { paddingVertical: SPACE.sm },
  actions: { gap: SPACE.sm },
  batch: { gap: SPACE.sm },
  batchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 44 },
  flex: { flex: 1 },
});
