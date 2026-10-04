import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { FadeIn, PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Card, Divider } from '../../components/controls';
import { HoldButton } from '../../components/HoldButton';
import { toast } from '../../components/Overlay';
import { ROLES } from '../../game/roles';
import type { GameState, PlayerId } from '../../game/types';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { dispatch, exitGame, startNextRound } from '../../state/gameStore';
import { useWordSource } from '../../state/wordSource';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { setupIssueMessage } from '../../utils/messages';
import { useGuardedCallback } from '../../utils/useGuardedCallback';
import { TwistBanner } from './CluePhase';
import { goHome } from './ResultPhases';

/**
 * Words-only style, after everyone has seen their card: who starts, which way
 * to go, then the phone goes down until someone holds the button for the answer.
 */
export function SimpleStartPhase({ state, onPeek }: { state: GameState; onPeek?: () => void }) {
  const t = useT();
  const p = usePalette();
  const round = state.round!;
  const nameOf = (id: PlayerId) => state.players.find((pl) => pl.id === id)?.name ?? '?';
  const order = round.clueOrder;
  const starter = nameOf(order[0]!);
  const scrambled = round.setup.modifiers.includes('randomOrder');
  const clockwise = round.setup.direction === 'clockwise';

  return (
    <View style={styles.root}>
      <ScrollView style={styles.answerScroll} contentContainerStyle={styles.top}>
        <AppText variant="label" tone="muted" align="center">
          {t('simple.title')}
        </AppText>
        <PopIn>
          <Card tone="primary" style={styles.startCard}>
            <AppText
              variant="hero"
              align="center"
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              accessibilityRole="header"
              testID="simple-start"
            >
              {t('simple.starts', { name: starter })}
            </AppText>
            {!scrambled ? (
              <View style={styles.directionRow} testID="simple-direction">
                <Ionicons
                  name="refresh"
                  size={30}
                  color={p.scheme === 'dark' ? '#B9A6FF' : p.primary}
                  style={clockwise ? null : styles.mirror}
                />
                <AppText variant="title" tone="primary">
                  {clockwise ? t('simple.clockwise') : t('simple.anticlockwise')}
                </AppText>
              </View>
            ) : null}
          </Card>
        </PopIn>
        <View
          style={styles.orderWrap}
          accessibilityLabel={`${t('simple.orderLabel')}: ${order.map(nameOf).join(', ')}`}
        >
          {order.map((id, i) => (
            <View key={id} style={[styles.chip, { backgroundColor: i === 0 ? p.primary : p.surfaceHigh }]}>
              <AppText variant="caption" style={{ color: i === 0 ? '#FFFFFF' : p.textMuted, fontWeight: '700' }}>
                {i + 1}. {nameOf(id)}
              </AppText>
            </View>
          ))}
        </View>
        <TwistBanner state={state} />
        <AppText variant="bodyStrong" tone="muted" align="center" style={styles.phoneDown}>
          {t('simple.phoneDown')}
        </AppText>
      </ScrollView>

      <View style={styles.actions}>
        <AppText variant="caption" tone="faint" align="center">
          {t('simple.holdHint')}
        </AppText>
        <HoldButton
          label={t('simple.holdReveal')}
          holdingLabel={t('simple.holding')}
          onComplete={() => dispatch({ type: 'REVEAL_ANSWER' })}
          testID="answer-hold"
        />
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

/** Words-only style: reveal who the Imposter(s) were and the word(s), then next round. */
export function AnswerPhase({ state }: { state: GameState }) {
  const t = useT();
  const source = useWordSource();
  const round = state.round!;
  const roles = round.setup.roles;
  const nameOf = (id: PlayerId) => state.players.find((pl) => pl.id === id)?.name ?? '?';
  const imposters = state.players.filter((pl) => roles[pl.id] === 'imposter').map((pl) => pl.name);
  const undercovers = state.players.filter((pl) => roles[pl.id] === 'undercover').map((pl) => pl.name);

  useEffect(() => {
    playSound('imposter');
    haptic('reveal');
  }, []);

  const next = useGuardedCallback(() => {
    const res = startNextRound(source);
    if (!res.ok) toast(setupIssueMessage(res.errors[0]!, t, state.players.length));
  }, 1200);

  const rows = state.players
    .map((pl) => ({ id: pl.id, role: roles[pl.id]! }))
    .sort((a, b) => Number(ROLES[b.role].hunted) - Number(ROLES[a.role].hunted));

  return (
    <View style={styles.root}>
      {/* Long role lists scroll; Next round / Home stay pinned above the navigation bar. */}
      <ScrollView style={styles.answerScroll} contentContainerStyle={styles.answerTop}>
        <AppText variant="label" tone="muted" align="center">
          {t('answer.title')}
        </AppText>
        {imposters.length > 0 ? (
          <PopIn style={styles.reveal}>
            <AppText variant="title" tone="muted" align="center">
              {t('answer.imposter_other', { count: imposters.length })}
            </AppText>
            <AppText
              variant="hero"
              tone="danger"
              align="center"
              numberOfLines={3}
              adjustsFontSizeToFit
              testID="answer-imposters"
            >
              {imposters.join(' & ')}
            </AppText>
          </PopIn>
        ) : null}
        {undercovers.length > 0 ? (
          <PopIn style={styles.reveal} delay={150}>
            <AppText variant="title" tone="muted" align="center">
              {t('answer.undercover_other', { count: undercovers.length })}
            </AppText>
            <AppText variant="display" tone="danger" align="center" numberOfLines={3} adjustsFontSizeToFit>
              {undercovers.join(' & ')}
            </AppText>
          </PopIn>
        ) : null}

        <FadeIn delay={250}>
          <Card tone="primary" style={styles.words}>
            <View style={styles.wordCol}>
              <AppText variant="label" tone="muted" align="center">
                {t('win.secretWord')}
              </AppText>
              <AppText variant="title" align="center" numberOfLines={2} adjustsFontSizeToFit testID="answer-word">
                {round.setup.word.word}
              </AppText>
              <AppText variant="caption" tone="faint" align="center">
                {round.setup.word.categoryName}
              </AppText>
            </View>
            {round.setup.altWord ? (
              <View style={styles.wordCol}>
                <AppText variant="label" tone="muted" align="center">
                  {t('win.undercoverWord')}
                </AppText>
                <AppText variant="title" align="center" numberOfLines={2} adjustsFontSizeToFit>
                  {round.setup.altWord}
                </AppText>
              </View>
            ) : null}
          </Card>
        </FadeIn>

        <FadeIn delay={400}>
          <AppText variant="label" tone="muted" style={styles.sectionLabel}>
            {t('win.roles')}
          </AppText>
          <Card style={styles.list}>
            {rows.map(({ id, role }, i) => (
              <React.Fragment key={id}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.roleRow} accessible accessibilityLabel={`${nameOf(id)}: ${t(`role.${role}`)}`}>
                  <AppText style={styles.roleEmoji}>{ROLES[role].emoji}</AppText>
                  <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                    {nameOf(id)}
                  </AppText>
                  <AppText variant="caption" tone={ROLES[role].hunted ? 'danger' : 'muted'}>
                    {t(`role.${role}`)}
                  </AppText>
                </View>
              </React.Fragment>
            ))}
          </Card>
        </FadeIn>
        <AppText variant="body" tone="muted" align="center">
          {t('answer.compare')}
        </AppText>
      </ScrollView>

      <View style={styles.actions}>
        <Button label={t('answer.nextRound')} icon="play" onPress={next} haptics="confirm" testID="answer-next" />
        <Button
          label={t('final.home')}
          icon="home"
          variant="secondary"
          size="md"
          onPress={() => {
            exitGame();
            goHome();
          }}
          testID="answer-home"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, justifyContent: 'space-between', paddingVertical: SPACE.md, gap: SPACE.lg },
  top: { gap: SPACE.md },
  startCard: { gap: SPACE.sm, alignItems: 'center', paddingVertical: SPACE.xl },
  directionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  mirror: { transform: [{ scaleX: -1 }] },
  orderWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, maxWidth: 170 },
  phoneDown: { marginTop: SPACE.sm },
  actions: { gap: SPACE.sm },
  answerScroll: { flex: 1 },
  answerTop: { gap: SPACE.lg, paddingBottom: SPACE.md },
  reveal: { alignItems: 'center', gap: SPACE.xs },
  words: { flexDirection: 'row', gap: SPACE.md },
  wordCol: { flex: 1, gap: 2 },
  sectionLabel: { marginBottom: SPACE.sm },
  list: { paddingVertical: SPACE.xs, paddingHorizontal: SPACE.md },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 48 },
  roleEmoji: { fontSize: 22, lineHeight: 28, width: 30, textAlign: 'center' },
  flex: { flex: 1 },
});
