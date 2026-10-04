import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { FadeIn } from '../components/anim';
import { Card, Divider, SectionTitle } from '../components/controls';
import { Screen } from '../components/Screen';
import { type TranslationKey, useT } from '../localization';
import { type PlayerStats, useStats, winRate } from '../state/stats';
import { RADIUS, SPACE, usePalette } from '../theme';
import { safeBack } from '../utils/navigation';

const DETAIL_FIELDS: { key: keyof PlayerStats | 'winRate'; label: TranslationKey; suffix?: string }[] = [
  { key: 'gamesPlayed', label: 'stats.gamesPlayed' },
  { key: 'wins', label: 'stats.wins' },
  { key: 'losses', label: 'stats.losses' },
  { key: 'winRate', label: 'stats.winRate', suffix: '%' },
  { key: 'imposterGames', label: 'stats.imposterGames' },
  { key: 'imposterWins', label: 'stats.imposterWinsP' },
  { key: 'civilianGames', label: 'stats.civilianGames' },
  { key: 'timesCaught', label: 'stats.timesCaught' },
  { key: 'successfulGuesses', label: 'stats.successfulGuesses' },
  { key: 'bestStreak', label: 'stats.bestStreak' },
  { key: 'currentStreak', label: 'stats.currentStreak' },
  { key: 'points', label: 'stats.points' },
];

export default function StatsScreen() {
  const t = useT();
  const p = usePalette();
  const stats = useStats();
  const [open, setOpen] = useState<string | null>(null);

  const players = useMemo(
    () =>
      Object.entries(stats.players).sort(
        ([, a], [, b]) => b.wins - a.wins || winRate(b) - winRate(a) || b.gamesPlayed - a.gamesPlayed,
      ),
    [stats.players],
  );

  const totals = [
    { label: t('stats.rounds'), value: stats.totals.rounds, emoji: '🎲' },
    { label: t('stats.civilianWins'), value: stats.totals.civilianWins, emoji: '😇' },
    { label: t('stats.imposterWins'), value: stats.totals.imposterWins, emoji: '🎭' },
    { label: t('stats.jesterWins'), value: stats.totals.jesterWins, emoji: '🃏' },
  ];

  return (
    <Screen title={t('stats.title')} onBack={() => safeBack()}>
      {stats.totals.rounds === 0 ? (
        <View style={styles.empty}>
          <AppText style={styles.emptyEmoji}>📊</AppText>
          <AppText variant="body" tone="muted" align="center" testID="stats-empty">
            {t('stats.empty')}
          </AppText>
        </View>
      ) : (
        <>
          <SectionTitle>{t('stats.overview')}</SectionTitle>
          <View style={styles.grid}>
            {totals.map((x) => (
              <Card key={x.label} style={styles.tile}>
                <AppText style={styles.tileEmoji}>{x.emoji}</AppText>
                <AppText variant="display">{x.value}</AppText>
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {x.label}
                </AppText>
              </Card>
            ))}
          </View>

          <SectionTitle>{t('stats.players')}</SectionTitle>
          <Card style={styles.list}>
            {players.map(([key, s], i) => {
              const expanded = open === key;
              return (
                <FadeIn key={key} delay={Math.min(i, 8) * 30}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => setOpen(expanded ? null : key)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`${s.name}. ${t('stats.summaryLine', { wins: t('stats.winCount_other', { count: s.wins }), rate: winRate(s) })}`}
                    style={styles.row}
                  >
                    <View style={[styles.avatar, { backgroundColor: p.primarySoft }]}>
                      <AppText variant="bodyStrong" tone="primary">
                        {Array.from(s.name)[0]?.toUpperCase() ?? '?'}
                      </AppText>
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {s.name}
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {t('stats.summaryLine', {
                          wins: t('stats.winCount_other', { count: s.wins }),
                          rate: winRate(s),
                        })}
                      </AppText>
                    </View>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={p.textFaint} />
                  </Pressable>
                  {expanded ? (
                    <View style={[styles.details, { backgroundColor: p.surfaceHigh }]}>
                      {DETAIL_FIELDS.map((f) => (
                        <View key={f.key} style={styles.detailRow}>
                          <AppText variant="body" tone="muted" style={styles.flex}>
                            {t(f.label)}
                          </AppText>
                          <AppText variant="bodyStrong">
                            {f.key === 'winRate' ? winRate(s) : (s[f.key] as number)}
                            {f.suffix ?? ''}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </FadeIn>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, paddingVertical: SPACE.xxl },
  emptyEmoji: { fontSize: 64, lineHeight: 76 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 2, padding: SPACE.md },
  tileEmoji: { fontSize: 22, lineHeight: 28 },
  list: { paddingVertical: SPACE.xs, paddingHorizontal: SPACE.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 60, paddingHorizontal: SPACE.xs },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  details: { borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.sm, gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
