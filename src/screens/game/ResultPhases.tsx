import { router } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { Confetti, FadeIn, PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Card, Divider, Pill } from '../../components/controls';
import { toast } from '../../components/Overlay';
import { ROLES } from '../../game/roles';
import type { GameState, Team } from '../../game/types';
import { haptic } from '../../haptics';
import { type TFunction, type TranslationKey, useT } from '../../localization';
import { dispatch, exitGame, startNewGame, startNextRound } from '../../state/gameStore';
import { useWordSource } from '../../state/wordSource';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { setupIssueMessage } from '../../utils/messages';
import { useGuardedCallback } from '../../utils/useGuardedCallback';

export function winnerHeadline(winners: readonly Team[], mode: GameState['config']['mode'], t: TFunction): string {
  if (winners.includes('jester')) return t('win.jester');
  if (winners.includes('civilians')) return t('win.civilians');
  return mode === 'undercover' ? t('win.undercovers') : t('win.imposters');
}

/** Navigates home, clearing the setup screens from the stack. */
export function goHome() {
  if (router.canDismiss()) router.dismissAll();
  else router.replace('/');
}

/** ROUND_RESULT */
export function RoundResultPhase({ state }: { state: GameState }) {
  const t = useT();
  const round = state.round!;
  const result = round.result!;
  const civiliansWon = result.winners.includes('civilians');

  useEffect(() => {
    playSound('win');
    haptic('success');
  }, []);

  const eliminated = new Set(round.eliminations.map((e) => e.playerId));
  const rows = state.players.map((pl) => ({
    player: pl,
    role: round.setup.roles[pl.id]!,
    delta: result.scoreDeltas[pl.id] ?? 0,
    out: eliminated.has(pl.id),
  }));
  rows.sort((a, b) => Number(ROLES[b.role].hunted) - Number(ROLES[a.role].hunted));

  return (
    <View style={styles.root}>
      <Confetti emojis={civiliansWon ? ['🎉', '😇', '✨', '🎊'] : ['🎭', '😈', '💥', '🃏']} />
      <PopIn style={styles.header}>
        <AppText style={styles.bigEmoji}>
          {civiliansWon ? '🏆' : result.winners.includes('jester') ? '🃏' : '🎭'}
        </AppText>
        <AppText
          variant="display"
          align="center"
          tone={civiliansWon ? 'success' : 'danger'}
          accessibilityRole="header"
          testID="round-winner"
        >
          {winnerHeadline(result.winners, state.config.mode, t)}
        </AppText>
        <AppText variant="body" tone="muted" align="center">
          {t(
            `win.reason.${result.reason}${state.config.mode === 'undercover' && result.reason !== 'jesterVotedOut' ? '.undercover' : ''}` as TranslationKey,
          )}
        </AppText>
      </PopIn>

      <FadeIn delay={250}>
        <Card tone="primary" style={styles.words}>
          <View style={styles.wordCol}>
            <AppText variant="label" tone="muted" align="center">
              {t('win.secretWord')}
            </AppText>
            <AppText variant="title" align="center" numberOfLines={2} adjustsFontSizeToFit testID="round-word">
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
        <Card style={styles.roleList}>
          {rows.map(({ player, role, delta, out }, i) => (
            <React.Fragment key={player.id}>
              {i > 0 ? <Divider /> : null}
              <View
                style={styles.roleRow}
                accessible
                accessibilityLabel={`${player.name}: ${t(`role.${role}`)}${delta ? `, +${delta}` : ''}`}
              >
                <AppText style={styles.roleEmoji}>{ROLES[role].emoji}</AppText>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {player.name}
                  </AppText>
                  <AppText variant="caption" tone={ROLES[role].hunted ? 'danger' : 'muted'}>
                    {t(`role.${role}`)}
                    {out ? ` · ${t('win.eliminated')}` : ''}
                  </AppText>
                </View>
                {state.config.scoring.enabled && delta > 0 ? <Pill label={`+${delta}`} tone="success" /> : null}
              </View>
            </React.Fragment>
          ))}
        </Card>
      </FadeIn>

      <Button
        label={t('win.scoreboard')}
        icon="podium"
        onPress={() => dispatch({ type: 'SHOW_SCOREBOARD' })}
        testID="round-scoreboard"
        style={{ marginTop: SPACE.sm }}
      />
    </View>
  );
}

function Standings({ state, showDelta }: { state: GameState; showDelta: boolean }) {
  const t = useT();
  const p = usePalette();
  const deltas = state.round?.result?.scoreDeltas ?? {};
  // Competition ranking: equal scores share a rank (1, 1, 3, …).
  const ranked = useMemo(() => {
    const sorted = state.players
      .map((pl) => ({ ...pl, score: state.scores[pl.id] ?? 0 }))
      .sort((a, b) => b.score - a.score);
    return sorted.map((pl) => ({ ...pl, rank: sorted.findIndex((x) => x.score === pl.score) + 1 }));
  }, [state.players, state.scores]);
  return (
    <Card style={styles.roleList}>
      {ranked.map((pl, i) => {
        const rank = pl.rank;
        const d = deltas[pl.id] ?? 0;
        return (
          <React.Fragment key={pl.id}>
            {i > 0 ? <Divider /> : null}
            <View
              style={styles.roleRow}
              accessible
              accessibilityLabel={`${rank}. ${pl.name}, ${t('common.points_other', { count: pl.score })}`}
            >
              <View style={[styles.rank, { backgroundColor: rank === 1 ? p.warning : p.surfaceHigh }]}>
                <AppText variant="bodyStrong" style={{ color: rank === 1 ? '#1A1300' : p.text }}>
                  {rank}
                </AppText>
              </View>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                {pl.name}
              </AppText>
              {showDelta && d > 0 ? (
                <AppText variant="caption" tone="success" style={{ fontWeight: '800' }}>
                  +{d}
                </AppText>
              ) : null}
              <AppText variant="heading" style={styles.score}>
                {pl.score}
              </AppText>
            </View>
          </React.Fragment>
        );
      })}
    </Card>
  );
}

/** SCOREBOARD */
export function ScoreboardPhase({ state }: { state: GameState }) {
  const t = useT();
  const source = useWordSource();
  const next = useGuardedCallback(() => {
    const res = startNextRound(source);
    if (!res.ok) toast(setupIssueMessage(res.errors[0]!, t, state.players.length));
  }, 1200);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="display" align="center" accessibilityRole="header">
          {t('scoreboard.title')}
        </AppText>
        <AppText variant="body" tone="muted" align="center">
          {t('scoreboard.afterRound', { round: state.round?.number ?? state.roundsPlayed })}
        </AppText>
      </View>
      {!state.config.scoring.enabled ? (
        <AppText variant="caption" tone="muted" align="center">
          {t('scoreboard.scoringOff')}
        </AppText>
      ) : null}
      <Standings state={state} showDelta />
      <View style={styles.actions}>
        <Button label={t('scoreboard.nextRound')} icon="play" onPress={next} haptics="confirm" testID="score-next" />
        <Button
          label={t('scoreboard.endGame')}
          icon="flag"
          variant="secondary"
          size="md"
          onPress={() => dispatch({ type: 'END_GAME' })}
          testID="score-end"
        />
      </View>
    </View>
  );
}

/** GAME_COMPLETE */
export function GameCompletePhase({ state }: { state: GameState }) {
  const t = useT();
  const source = useWordSource();
  const top = Math.max(0, ...state.players.map((pl) => state.scores[pl.id] ?? 0));
  const leaders = state.players.filter((pl) => (state.scores[pl.id] ?? 0) === top);

  useEffect(() => {
    playSound('win');
    haptic('success');
  }, []);

  const playAgain = useGuardedCallback(() => {
    const res = startNewGame(state.players, state.config, source);
    if (!res.ok) toast(setupIssueMessage(res.errors[0]!, t, state.players.length));
  }, 1200);

  return (
    <View style={styles.root}>
      <Confetti emojis={['👑', '🎉', '✨', '🏆']} />
      <PopIn style={styles.header}>
        <AppText style={styles.bigEmoji}>👑</AppText>
        <AppText variant="display" align="center" accessibilityRole="header">
          {t('final.title')}
        </AppText>
        <AppText variant="title" tone="primary" align="center" testID="final-winner">
          {state.config.scoring.enabled && top > 0
            ? leaders.length === 1
              ? t('final.winner', { name: leaders[0]!.name })
              : t('final.tie')
            : t('final.rounds_other', { count: state.roundsPlayed })}
        </AppText>
        {state.config.scoring.enabled ? (
          <AppText variant="caption" tone="muted" align="center">
            {t('final.rounds_other', { count: state.roundsPlayed })}
          </AppText>
        ) : null}
      </PopIn>
      {state.config.scoring.enabled ? <Standings state={state} showDelta={false} /> : null}
      {state.history.length > 0 ? (
        <Card style={styles.roleList}>
          {state.history.map((h, i) => (
            <React.Fragment key={`${h.number}-${i}`}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.roleRow}>
                <AppText variant="caption" tone="faint" style={styles.histNum}>
                  #{h.number}
                </AppText>
                <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                  {h.word}
                  {h.altWord ? ` / ${h.altWord}` : ''}
                </AppText>
                <AppText
                  variant="caption"
                  tone={h.winners.includes('civilians') ? 'success' : 'danger'}
                  numberOfLines={1}
                >
                  {winnerHeadline(h.winners, state.config.mode, t)}
                </AppText>
              </View>
            </React.Fragment>
          ))}
        </Card>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={t('final.playAgain')}
          icon="refresh"
          onPress={playAgain}
          haptics="confirm"
          testID="final-again"
        />
        <Button
          label={t('final.home')}
          icon="home"
          variant="secondary"
          size="md"
          onPress={() => {
            exitGame();
            goHome();
          }}
          testID="final-home"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingVertical: SPACE.md, gap: SPACE.lg },
  header: { alignItems: 'center', gap: SPACE.sm },
  bigEmoji: { fontSize: 64, lineHeight: 76 },
  words: { flexDirection: 'row', gap: SPACE.md },
  wordCol: { flex: 1, gap: 2 },
  sectionLabel: { marginBottom: SPACE.sm },
  roleList: { paddingVertical: SPACE.xs, paddingHorizontal: SPACE.md },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 52, paddingVertical: 4 },
  roleEmoji: { fontSize: 24, lineHeight: 30, width: 32, textAlign: 'center' },
  rank: { width: 32, height: 32, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  score: { minWidth: 36, textAlign: 'right' },
  histNum: { width: 32 },
  actions: { gap: SPACE.sm, marginTop: 'auto' },
  flex: { flex: 1 },
});
