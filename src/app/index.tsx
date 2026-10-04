import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { setMusicWanted } from '../audio/sound';
import { AppText } from '../components/AppText';
import { FadeIn, Pulse } from '../components/anim';
import { Button } from '../components/Button';
import { Card } from '../components/controls';
import { choose, toast } from '../components/Overlay';
import { Screen } from '../components/Screen';
import { BUILT_IN_CATEGORIES, totalBuiltInWords } from '../data/words';
import { QUICK_PLAY_CONFIG, QUICK_PLAY_PLAYER_COUNT } from '../game/engine/config';
import { randomId } from '../game/engine/seed';
import { validatePlayers } from '../game/engine/validation';
import type { GameState, Player } from '../game/types';
import { useT } from '../localization';
import { configStore, rosterStore } from '../state/appData';
import { discardSavedGame, getGameState, loadSavedGame, resumeGame, startNewGame } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { useWordSource } from '../state/wordSource';
import { RADIUS, SPACE, usePalette } from '../theme';
import { useGuardedCallback } from '../utils/useGuardedCallback';

const WORD_COUNT = Math.floor(totalBuiltInWords() / 100) * 100;

export default function HomeScreen() {
  const t = useT();
  const p = usePalette();
  const settings = useSettings();
  const source = useWordSource();
  const [saved, setSaved] = useState<GameState | null>(null);
  const checkedSave = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setMusicWanted(true);
    }, []),
  );

  const askResume = useCallback(
    async (game: GameState) => {
      const players = t('common.players_other', { count: game.players.length });
      const choice = await choose(
        t('resume.title'),
        t('resume.body', { players }),
        [
          { label: t('resume.resume'), value: 'resume', variant: 'primary' },
          { label: t('resume.new'), value: 'new', variant: 'secondary' },
          { label: t('resume.abandon'), value: 'abandon', variant: 'ghost' },
        ],
        'later',
      );
      if (choice === 'resume') {
        resumeGame(game);
        setSaved(null);
        router.push('/game');
      } else if (choice === 'new' || choice === 'abandon') {
        await discardSavedGame();
        setSaved(null);
        if (choice === 'new') router.push('/setup/players');
      }
    },
    [t],
  );

  useEffect(() => {
    if (!settings.onboardingDone || checkedSave.current) return;
    checkedSave.current = true;
    loadSavedGame().then((res) => {
      if (res.kind === 'found' && getGameState().phase === 'IDLE') {
        setSaved(res.game);
        void askResume(res.game);
      } else if (res.kind === 'corrupted') {
        toast(t('resume.corrupted'));
      }
    });
  }, [settings.onboardingDone, askResume, t]);

  const quickPlay = useGuardedCallback(() => {
    const roster = rosterStore.get();
    const players: Player[] =
      roster.length >= 3 && validatePlayers(roster).length === 0
        ? roster
        : Array.from({ length: QUICK_PLAY_PLAYER_COUNT }, (_, i) => ({
            id: randomId('p_'),
            name: t('players.defaultName', { index: i + 1 }),
          }));
    if (roster.length < 3) rosterStore.set(players);
    // Quick Play keeps the group's play style and topic switches.
    const saved = configStore.get();
    const res = startNewGame(
      players,
      {
        ...QUICK_PLAY_CONFIG,
        playStyle: saved.playStyle,
        excludedCategories: saved.excludedCategories,
        customInRandom: saved.customInRandom,
      },
      source,
    );
    if (res.ok) {
      setSaved(null);
      router.push('/game');
    } else toast(t('common.error.generic'));
  }, 800);

  const go = useGuardedCallback((path: '/setup/players' | '/rules' | '/categories' | '/stats' | '/settings') =>
    router.push(path),
  );

  if (!settings.onboardingDone) return <Redirect href="/onboarding" />;

  const tiles = [
    { key: 'rules', icon: 'book' as const, label: t('home.rules'), path: '/rules' as const },
    { key: 'categories', icon: 'grid' as const, label: t('home.categories'), path: '/categories' as const },
    { key: 'stats', icon: 'stats-chart' as const, label: t('home.stats'), path: '/stats' as const },
    { key: 'settings', icon: 'settings' as const, label: t('home.settings'), path: '/settings' as const },
  ];

  return (
    <Screen contentStyle={styles.content}>
      <FadeIn style={styles.hero}>
        <Pulse>
          <View
            collapsable={false}
            style={[styles.logoWrap, { backgroundColor: p.scheme === 'light' ? p.primary : 'transparent' }]}
          >
            <Image
              source={require('../../assets/images/logo.png')}
              style={p.scheme === 'light' ? styles.logoSmall : styles.logo}
              accessibilityIgnoresInvertColors
              accessible={false}
            />
          </View>
        </Pulse>
        <AppText variant="hero" align="center" accessibilityRole="header" style={styles.title}>
          IMPOSTER
        </AppText>
        <View style={[styles.partyTag, { backgroundColor: p.danger }]}>
          <AppText variant="label" style={styles.partyText}>
            PARTY
          </AppText>
        </View>
        <AppText variant="body" tone="muted" align="center" style={styles.tagline}>
          {t('app.tagline')}
        </AppText>
      </FadeIn>

      {saved ? (
        <FadeIn>
          <Card tone="primary" style={styles.resume}>
            <AppText variant="heading">{t('home.resumeTitle')}</AppText>
            <AppText variant="caption" tone="muted">
              {t('home.resumeBody', {
                round: saved.round?.number ?? saved.roundsPlayed + 1,
                players: t('common.players_other', { count: saved.players.length }),
              })}
            </AppText>
            <View style={styles.resumeRow}>
              <Button
                label={t('home.resume')}
                size="md"
                style={styles.flex}
                onPress={() => {
                  resumeGame(saved);
                  setSaved(null);
                  router.push('/game');
                }}
              />
              <Button
                label={t('home.abandon')}
                size="md"
                variant="ghost"
                style={styles.flex}
                onPress={() => {
                  void discardSavedGame();
                  setSaved(null);
                }}
              />
            </View>
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn delay={120} style={styles.actions}>
        <Button
          label={t('home.play')}
          hint={t('home.playHint')}
          size="xl"
          icon="play"
          onPress={() => go('/setup/players')}
          haptics="confirm"
          testID="home-play"
        />
        <Button
          label={t('home.quickPlay')}
          hint={t('home.quickPlayHint')}
          variant="secondary"
          icon="flash"
          onPress={quickPlay}
          testID="home-quick"
        />
      </FadeIn>

      <FadeIn delay={220} style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            onPress={() => go(tile.path)}
            accessibilityRole="button"
            accessibilityLabel={tile.label}
            testID={`home-${tile.key}`}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: pressed ? p.surfaceHigh : p.surface, borderColor: p.border },
            ]}
          >
            <Ionicons name={tile.icon} size={24} color={p.scheme === 'dark' ? '#A894FF' : p.primary} />
            <AppText variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>
              {tile.label}
            </AppText>
          </Pressable>
        ))}
      </FadeIn>

      <AppText variant="caption" tone="faint" align="center" style={styles.footer}>
        {t('home.wordCount', { count: WORD_COUNT.toLocaleString(), categories: BUILT_IN_CATEGORIES.length })}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: SPACE.xl, gap: SPACE.lg },
  hero: { alignItems: 'center', marginBottom: SPACE.sm },
  logoWrap: {
    width: 132,
    height: 132,
    borderRadius: 40,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logo: { width: 132, height: 132 },
  logoSmall: { width: 104, height: 104 },
  title: { marginTop: -8 },
  partyTag: {
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    transform: [{ rotate: '-3deg' }],
  },
  partyText: { color: '#FFFFFF', letterSpacing: 6 },
  tagline: { marginTop: SPACE.md },
  actions: { gap: SPACE.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 76,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: SPACE.md,
  },
  resume: { gap: SPACE.sm },
  resumeRow: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.xs },
  flex: { flex: 1 },
  footer: { marginTop: 'auto', paddingTop: SPACE.lg },
});
