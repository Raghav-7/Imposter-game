import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card, Pill, SectionTitle, Segmented, Stepper, ToggleRow } from '../../components/controls';
import { toast } from '../../components/Overlay';
import { Screen } from '../../components/Screen';
import { CLUE_TIMER_OPTIONS, DISCUSSION_TIMER_OPTIONS } from '../../game/engine/config';
import { maxImposters, MIN_PLAYERS_FOR_JESTER, validateSetup } from '../../game/engine/validation';
import { MODE_ORDER, MODES } from '../../game/modes';
import { SCORE_LIMITS } from '../../game/scoring';
import type { GameConfig, ScoringConfig } from '../../game/types';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { setupIssueMessage } from '../../utils/messages';
import { updateGameConfig, useCustomCategories, useGameConfig, useRoster } from '../../state/appData';
import { enterSetupPhase, startNewGame } from '../../state/gameStore';
import { describeCategory, useWordSource } from '../../state/wordSource';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { useGuardedCallback } from '../../utils/useGuardedCallback';
import { safeBack } from '../../utils/navigation';

export default function ConfigScreen() {
  const t = useT();
  const p = usePalette();
  const players = useRoster();
  const config = useGameConfig();
  const custom = useCustomCategories();
  const source = useWordSource();
  const [advanced, setAdvanced] = useState(false);

  useFocusEffect(
    useCallback(() => {
      enterSetupPhase('config');
    }, []),
  );

  const n = players.length;
  const max = Math.max(1, maxImposters(n, config));
  const jesterAllowed =
    n >= MIN_PLAYERS_FOR_JESTER && maxImposters(n, { roles: { ...config.roles, jester: true } }) >= 1;

  // Keep the config valid when the player count changes.
  useEffect(() => {
    if (config.imposterCount > max) updateGameConfig({ imposterCount: max });
    if (config.roles.jester && !jesterAllowed) updateGameConfig({ roles: { ...config.roles, jester: false } });
  }, [config.imposterCount, config.roles, max, jesterAllowed]);

  const set = (patch: Partial<GameConfig>) => updateGameConfig(patch);
  // Timers, voting and scoring only apply when the whole game is played on the phone.
  const full = config.playStyle === 'full';
  const setScoring = (patch: Partial<ScoringConfig>) => set({ scoring: { ...config.scoring, ...patch } });

  const issues = validateSetup(players, config, source);
  const category = describeCategory(config.categoryId, t, custom);
  const isCustom = config.categoryId.startsWith('custom:');
  const hiddenLabel = config.mode === 'undercover' ? t('config.undercovers') : t('config.imposters');
  const countLabel = (c: number) =>
    config.mode === 'undercover'
      ? t('common.undercovers_other', { count: c })
      : t('common.imposters_other', { count: c });

  const start = useGuardedCallback(() => {
    if (issues.length > 0) {
      haptic('error');
      toast(setupIssueMessage(issues[0]!, t, n));
      return;
    }
    const res = startNewGame(players, config, source);
    if (!res.ok) {
      haptic('error');
      toast(setupIssueMessage(res.errors[0]!, t, n));
      return;
    }
    haptic('confirm');
    router.push('/game');
  }, 1200);

  const sec = (s: number) => (s === 0 ? t('common.off') : t('common.seconds', { count: s }));
  const discussionLabel = (s: number) =>
    s === 0 ? '∞' : s % 60 === 0 ? t('common.minutes', { count: s / 60 }) : t('common.seconds', { count: s });

  return (
    <Screen
      title={t('config.title')}
      onBack={() => safeBack('/setup/players')}
      footer={
        <>
          {issues.length > 0 ? (
            <AppText variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
              {setupIssueMessage(issues[0]!, t, n)}
            </AppText>
          ) : null}
          <Button
            label={t('config.start')}
            icon="sparkles"
            size="lg"
            haptics="confirm"
            disabled={issues.length > 0}
            onPress={start}
            testID="config-start"
          />
        </>
      }
    >
      <View style={styles.summary}>
        <Pill label={t('common.players_other', { count: n })} tone="primary" />
        <Pill label={countLabel(Math.min(config.imposterCount, max))} tone="danger" />
        <Pill label={`${category.emoji} ${category.name}`} />
      </View>

      <AppText variant="caption" tone="muted" style={styles.styleNote}>
        {t('config.playStyleNote', {
          style: full ? t('settings.playStyle.full') : t('settings.playStyle.simple'),
        })}
      </AppText>

      <SectionTitle>{t('config.mode')}</SectionTitle>
      <View style={styles.modes} accessibilityRole="radiogroup">
        {MODE_ORDER.map((id) => {
          const selected = config.mode === id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                haptic('select');
                set({ mode: id });
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(`mode.${id}.name`)}. ${t(`mode.${id}.desc`)}`}
              testID={`mode-${id}`}
              style={[
                styles.mode,
                {
                  backgroundColor: selected ? p.primarySoft : p.surface,
                  borderColor: selected ? p.primary : p.border,
                },
              ]}
            >
              <View style={styles.modeHead}>
                <AppText style={styles.modeEmoji}>{MODES[id].emoji}</AppText>
                {selected ? <Ionicons name="checkmark-circle" size={20} color={p.primary} /> : null}
              </View>
              <AppText variant="heading">{t(`mode.${id}.name`)}</AppText>
              <AppText variant="caption" tone="muted">
                {t(`mode.${id}.desc`)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle hint={t('config.impostersHint', { max, players: t('common.players_other', { count: n }) })}>
        {hiddenLabel}
      </SectionTitle>
      <Card style={styles.stepperCard}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {countLabel(Math.min(config.imposterCount, max))}
        </AppText>
        <Stepper
          value={Math.min(config.imposterCount, max)}
          min={1}
          max={max}
          onChange={(v) => set({ imposterCount: v })}
          label={hiddenLabel}
        />
      </Card>

      <SectionTitle>{t('config.category')}</SectionTitle>
      <Pressable
        onPress={() => router.push('/setup/category')}
        accessibilityRole="button"
        accessibilityLabel={`${t('config.category')}: ${category.name}`}
        testID="config-category"
        style={({ pressed }) => [
          styles.categoryRow,
          { backgroundColor: pressed ? p.surfaceHigh : p.surface, borderColor: category.exists ? p.border : p.danger },
        ]}
      >
        <AppText style={styles.categoryEmoji}>{category.emoji}</AppText>
        <AppText variant="heading" style={styles.flex} numberOfLines={1}>
          {category.name}
        </AppText>
        <Ionicons name="chevron-forward" size={22} color={p.textMuted} />
      </Pressable>

      {!isCustom ? (
        <>
          <SectionTitle hint={t(`difficulty.${config.difficulty}.hint`)}>{t('config.difficulty')}</SectionTitle>
          <Segmented
            label={t('config.difficulty')}
            value={config.difficulty}
            onChange={(v) => set({ difficulty: v })}
            options={(['easy', 'medium', 'hard'] as const).map((d) => ({ value: d, label: t(`difficulty.${d}`) }))}
          />
        </>
      ) : null}

      {full ? (
        <>
          <SectionTitle>{t('config.timers')}</SectionTitle>
          <AppText variant="caption" tone="muted" style={styles.subLabel}>
            {t('config.clueTimer')}
          </AppText>
          <Segmented
            label={t('config.clueTimer')}
            value={config.clueTimerSec}
            onChange={(v) => set({ clueTimerSec: v })}
            options={CLUE_TIMER_OPTIONS.map((s) => ({ value: s, label: sec(s) }))}
          />
          <AppText variant="caption" tone="muted" style={styles.subLabel}>
            {t('config.discussionTimer')}
          </AppText>
          <Segmented
            label={t('config.discussionTimer')}
            value={config.discussionTimerSec}
            onChange={(v) => set({ discussionTimerSec: v })}
            options={DISCUSSION_TIMER_OPTIONS.map((s) => ({
              value: s,
              label: discussionLabel(s),
              accessibilityLabel: s === 0 ? t('common.unlimited') : discussionLabel(s),
            }))}
          />
        </>
      ) : null}

      <SectionTitle hint={t('config.rolesHint')}>{t('config.roles')}</SectionTitle>
      <Card style={styles.listCard}>
        <ToggleRow
          icon="🔍"
          label={t('role.detective')}
          hint={t('role.detective.desc')}
          value={config.roles.detective}
          onChange={(v) => set({ roles: { ...config.roles, detective: v } })}
        />
        <ToggleRow
          icon="🃏"
          label={t('role.jester')}
          hint={jesterAllowed ? t('role.jester.desc') : t('config.jesterNeeds', { min: MIN_PLAYERS_FOR_JESTER })}
          value={config.roles.jester}
          disabled={!jesterAllowed}
          onChange={(v) => set({ roles: { ...config.roles, jester: v } })}
        />
      </Card>

      <Pressable
        onPress={() => setAdvanced((a) => !a)}
        accessibilityRole="button"
        accessibilityState={{ expanded: advanced }}
        style={styles.advancedToggle}
        testID="config-advanced"
      >
        <AppText variant="label" tone="muted">
          {t('config.advanced')}
        </AppText>
        <Ionicons name={advanced ? 'chevron-up' : 'chevron-down'} size={18} color={p.textMuted} />
      </Pressable>

      {advanced ? (
        <View style={styles.advanced}>
          {full ? (
            <>
              <AppText variant="caption" tone="muted" style={styles.subLabel}>
                {t('config.tieRule')}
              </AppText>
              <Segmented
                label={t('config.tieRule')}
                value={config.tieRule}
                onChange={(v) => set({ tieRule: v })}
                options={[
                  { value: 'revote', label: t('config.tie.revote') },
                  { value: 'random', label: t('config.tie.random') },
                ]}
              />
            </>
          ) : null}
          <Card style={[styles.listCard, styles.gapTop]}>
            {full ? (
              <ToggleRow
                label={t('config.finalGuess')}
                value={config.finalGuess}
                onChange={(v) => set({ finalGuess: v })}
              />
            ) : null}
            {config.mode === 'classic' || config.mode === 'chaos' ? (
              <ToggleRow
                label={t('config.imposterHint')}
                hint={t('config.imposterHintHint')}
                value={config.imposterHint}
                onChange={(v) => set({ imposterHint: v })}
                testID="config-hint"
              />
            ) : null}
            <ToggleRow
              label={t('config.teammates')}
              value={config.impostersSeeTeammates}
              onChange={(v) => set({ impostersSeeTeammates: v })}
            />
            {config.mode === 'undercover' ? (
              <ToggleRow
                label={t('config.undercoverAware')}
                value={config.undercoverAware}
                onChange={(v) => set({ undercoverAware: v })}
              />
            ) : null}
          </Card>
          {full && config.finalGuess ? (
            <>
              <AppText variant="caption" tone="muted" style={styles.subLabel}>
                {t('config.guessStyle')}
              </AppText>
              <Segmented
                label={t('config.guessStyle')}
                value={config.guessStyle}
                onChange={(v) => set({ guessStyle: v })}
                options={[
                  { value: 'choice', label: t('config.guess.choice') },
                  { value: 'type', label: t('config.guess.type') },
                ]}
              />
            </>
          ) : null}
          {config.mode === 'chaos' ? (
            <>
              <AppText variant="caption" tone="muted" style={styles.subLabel}>
                {t('config.chaosCount')}
              </AppText>
              <Segmented
                label={t('config.chaosCount')}
                value={config.chaosModifierCount}
                onChange={(v) => set({ chaosModifierCount: v })}
                options={[
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
              />
            </>
          ) : null}

          {full ? (
            <>
              <SectionTitle>{t('config.scoring')}</SectionTitle>
              <Card style={styles.listCard}>
                <ToggleRow
                  label={t('config.scoringEnabled')}
                  value={config.scoring.enabled}
                  onChange={(v) => setScoring({ enabled: v })}
                />
                {config.scoring.enabled
                  ? (
                      [
                        'civilianCorrectVote',
                        'civilianWin',
                        'imposterSurvive',
                        'imposterGuess',
                        'jesterVotedOut',
                      ] as const
                    ).map((k) => (
                      <View key={k} style={styles.scoreRow}>
                        <AppText variant="body" style={styles.flex}>
                          {t(`config.score.${k}`)}
                        </AppText>
                        <Stepper
                          value={config.scoring[k]}
                          min={SCORE_LIMITS.min}
                          max={SCORE_LIMITS.max}
                          onChange={(v) => setScoring({ [k]: v })}
                          label={t(`config.score.${k}`)}
                        />
                      </View>
                    ))
                  : null}
              </Card>
            </>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  styleNote: { marginTop: SPACE.sm },
  summary: { flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap' },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  mode: { flexBasis: '47%', flexGrow: 1, borderRadius: RADIUS.lg, borderWidth: 1.5, padding: SPACE.md, gap: 4 },
  modeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeEmoji: { fontSize: 26, lineHeight: 32 },
  stepperCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.sm },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACE.lg,
  },
  categoryEmoji: { fontSize: 28, lineHeight: 34 },
  subLabel: { marginTop: SPACE.md, marginBottom: SPACE.xs },
  listCard: { paddingVertical: SPACE.xs, paddingHorizontal: SPACE.xs },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACE.xl,
    minHeight: 48,
  },
  advanced: { gap: 2 },
  gapTop: { marginTop: SPACE.md },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    gap: SPACE.sm,
  },
  flex: { flex: 1 },
});
