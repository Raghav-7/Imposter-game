import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { Confetti, FadeIn, PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Card } from '../../components/controls';
import { eliminationsLeft, getNextStep, huntedRemaining } from '../../game/engine/outcome';
import { isHunted } from '../../game/roles';
import type { GameState, RoleId } from '../../game/types';
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

/** ELIMINATION: dramatic role reveal of the voted-out player, then the next step. */
export function EliminationPhase({ state }: { state: GameState }) {
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
  const hiddenCount = huntedRemaining(round).length;
  const hiddenLabel =
    state.config.mode === 'undercover'
      ? t('common.undercovers_other', { count: hiddenCount })
      : t('common.imposters_other', { count: hiddenCount });

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
        {shown && step.kind === 'guess' ? (
          <FadeIn delay={300}>
            <AppText variant="heading" tone="warning" align="center">
              {t('elim.lastChance')}
            </AppText>
          </FadeIn>
        ) : null}
        {shown && step.kind === 'continue' ? (
          <Card tone="danger" style={styles.hunt}>
            <AppText variant="bodyStrong" align="center">
              {t('elim.stillHiding', {
                hidden: hiddenLabel,
                votes: t('discussion.votesLeft_other', { count: eliminationsLeft(round) }),
              })}
            </AppText>
          </Card>
        ) : null}
      </View>

      {shown ? (
        <View style={styles.actions}>
          {step.kind === 'guess' ? (
            <Button
              label={t('elim.giveGuess', { name })}
              icon="help-circle"
              size="lg"
              onPress={() => dispatch({ type: 'START_GUESS' })}
              testID="elim-guess"
            />
          ) : null}
          {step.kind === 'continue' ? (
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
          ) : null}
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: SPACE.md, gap: SPACE.lg },
  center: { flex: 1, justifyContent: 'center', gap: SPACE.lg },
  reveal: { gap: SPACE.sm, alignItems: 'center' },
  suspense: { fontSize: 88, lineHeight: 104 },
  hunt: { paddingVertical: SPACE.sm },
  actions: { gap: SPACE.sm },
});
