import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { FadeIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Pill } from '../../components/controls';
import { confirm, toast } from '../../components/Overlay';
import { Screen } from '../../components/Screen';
import { createRng, shuffle } from '../../game/engine/rng';
import { randomId, randomSeed } from '../../game/engine/seed';
import { clampLength, cleanText, MAX_NAME_LENGTH, normalizeKey } from '../../game/engine/text';
import { maxImposters, validatePlayers } from '../../game/engine/validation';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../game/modes';
import type { Player } from '../../game/types';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { rosterStore, useGameConfig, useRoster } from '../../state/appData';
import { enterSetupPhase, leaveSetup } from '../../state/gameStore';
import { RADIUS, SPACE, TOUCH, usePalette } from '../../theme';
import { useGuardedCallback } from '../../utils/useGuardedCallback';
import { safeBack } from '../../utils/navigation';

export default function PlayersScreen() {
  const t = useT();
  const p = usePalette();
  const players = useRoster();
  const config = useGameConfig();
  const [draft, setDraft] = useState('');
  const addRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      enterSetupPhase('players');
    }, []),
  );
  // Leaving setup (back button / gesture) returns the state machine to IDLE.
  useEffect(() => () => leaveSetup(), []);

  const setPlayers = (next: Player[]) => rosterStore.set(next);

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    players.forEach((pl) => {
      const k = normalizeKey(pl.name);
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
  }, [players]);

  const issues = validatePlayers(players);
  const issueText = issues.includes('tooFewPlayers')
    ? t('players.error.tooFew', { min: MIN_PLAYERS })
    : issues.includes('blankName')
      ? t('players.error.blank')
      : issues.includes('duplicateName')
        ? t('players.error.duplicate')
        : issues.includes('tooManyPlayers')
          ? t('players.error.tooMany', { max: MAX_PLAYERS })
          : issues.includes('nameTooLong')
            ? t('players.error.tooLong', { max: MAX_NAME_LENGTH })
            : null;

  const addPlayer = (name: string) => {
    const clean = clampLength(cleanText(name), MAX_NAME_LENGTH);
    if (!clean) return;
    if (players.length >= MAX_PLAYERS) {
      toast(t('players.full', { max: MAX_PLAYERS }));
      return;
    }
    if (players.some((pl) => normalizeKey(pl.name) === normalizeKey(clean))) {
      haptic('error');
      toast(t('players.error.duplicateShort'));
      return;
    }
    haptic('tap');
    setPlayers([...players, { id: randomId('p_'), name: clean }]);
    setDraft('');
  };

  const quickAdd = useGuardedCallback(() => {
    if (players.length >= MAX_PLAYERS) {
      toast(t('players.full', { max: MAX_PLAYERS }));
      return;
    }
    const taken = new Set(players.map((pl) => normalizeKey(pl.name)));
    let i = players.length + 1;
    let name = t('players.defaultName', { index: i });
    while (taken.has(normalizeKey(name))) name = t('players.defaultName', { index: ++i });
    haptic('tap');
    setPlayers([...players, { id: randomId('p_'), name }]);
  }, 150);

  const shufflePlayers = useGuardedCallback(() => {
    haptic('confirm');
    setPlayers(shuffle(createRng(randomSeed()), players));
  });

  const clearAll = async () => {
    if (
      await confirm({
        title: t('players.clearConfirm'),
        confirmLabel: t('players.clear'),
        cancelLabel: t('common.cancel'),
        destructive: true,
      })
    ) {
      setPlayers([]);
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= players.length) return;
    const next = players.slice();
    [next[index], next[target]] = [next[target]!, next[index]!];
    haptic('select');
    setPlayers(next);
  };

  const rename = (id: string, name: string) =>
    setPlayers(
      players.map((pl) =>
        pl.id === id ? { ...pl, name: clampLength(name.replace(/\s{2,}/g, ' '), MAX_NAME_LENGTH) } : pl,
      ),
    );

  const remove = (id: string) => {
    haptic('tap');
    setPlayers(players.filter((pl) => pl.id !== id));
  };

  const next = useGuardedCallback(() => {
    // Tidy names (trim) before moving on.
    setPlayers(players.map((pl) => ({ ...pl, name: cleanText(pl.name) })));
    router.push('/setup/config');
  }, 800);

  const maxImp = maxImposters(players.length, config);

  return (
    <Screen
      title={t('players.title')}
      onBack={() => safeBack()}
      right={
        <Pressable
          onPress={shufflePlayers}
          accessibilityRole="button"
          accessibilityLabel={t('players.shuffle')}
          style={styles.headerBtn}
          disabled={players.length < 2}
        >
          <Ionicons name="shuffle" size={24} color={players.length < 2 ? p.textFaint : p.text} />
        </Pressable>
      }
      footer={
        <>
          {issueText && players.length > 0 ? (
            <AppText variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
              {issueText}
            </AppText>
          ) : null}
          <Button
            label={t('players.next')}
            iconRight="arrow-forward"
            disabled={issues.length > 0}
            onPress={next}
            testID="players-next"
          />
        </>
      }
    >
      <View style={styles.summary}>
        <Pill label={t('common.players_other', { count: players.length })} tone="primary" />
        {players.length >= MIN_PLAYERS ? (
          <Pill
            label={`${t('config.impostersHint', { max: maxImp, players: t('common.players_other', { count: players.length }) })}`}
          />
        ) : null}
      </View>

      {players.length === 0 ? (
        <AppText variant="body" tone="muted" style={styles.empty}>
          {t('players.empty')}
        </AppText>
      ) : null}

      <View style={styles.list}>
        {players.map((pl, index) => {
          const dup = duplicateKeys.has(normalizeKey(pl.name));
          const blank = cleanText(pl.name).length === 0;
          const bad = dup || blank;
          return (
            <FadeIn key={pl.id} duration={200} from={6}>
              <View style={[styles.row, { backgroundColor: p.surface, borderColor: bad ? p.danger : p.border }]}>
                <View style={[styles.badge, { backgroundColor: p.primarySoft }]}>
                  <AppText variant="bodyStrong" tone="primary">
                    {index + 1}
                  </AppText>
                </View>
                <TextInput
                  value={pl.name}
                  onChangeText={(v) => rename(pl.id, v)}
                  placeholder={t('players.defaultName', { index: index + 1 })}
                  placeholderTextColor={p.textFaint}
                  style={[styles.input, { color: p.text }]}
                  accessibilityLabel={t('players.rename', { index: index + 1 })}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  maxFontSizeMultiplier={1.6}
                  testID={`player-name-${index}`}
                />
                {dup ? (
                  <AppText variant="caption" tone="danger" style={styles.dupText}>
                    {t('players.error.duplicateShort')}
                  </AppText>
                ) : null}
                <IconBtn
                  icon="chevron-up"
                  label={t('players.moveUp', { name: pl.name })}
                  onPress={() => move(index, -1)}
                  disabled={index === 0}
                />
                <IconBtn
                  icon="chevron-down"
                  label={t('players.moveDown', { name: pl.name })}
                  onPress={() => move(index, 1)}
                  disabled={index === players.length - 1}
                />
                <IconBtn
                  icon="close"
                  label={t('players.remove', { name: pl.name })}
                  onPress={() => remove(pl.id)}
                  danger
                />
              </View>
            </FadeIn>
          );
        })}
      </View>

      {players.length < MAX_PLAYERS ? (
        <View style={[styles.addRow, { backgroundColor: p.surfaceHigh, borderColor: p.border }]}>
          <TextInput
            ref={addRef}
            value={draft}
            onChangeText={(v) => setDraft(clampLength(v, MAX_NAME_LENGTH))}
            onSubmitEditing={() => {
              addPlayer(draft);
              addRef.current?.focus();
            }}
            submitBehavior="submit"
            placeholder={t('players.addPlaceholder')}
            placeholderTextColor={p.textFaint}
            style={[styles.input, { color: p.text }]}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel={t('players.addPlaceholder')}
            maxFontSizeMultiplier={1.6}
            testID="player-add-input"
          />
          <Button
            label={t('players.add')}
            size="md"
            icon="add"
            onPress={() => addPlayer(draft)}
            disabled={!cleanText(draft)}
            cooldownMs={150}
            testID="player-add"
          />
        </View>
      ) : null}

      <View style={styles.tools}>
        <Button
          label={t('players.quickAdd')}
          variant="ghost"
          size="md"
          icon="person-add"
          onPress={quickAdd}
          style={styles.flex}
          testID="player-quick-add"
        />
        <Button
          label={t('players.clear')}
          variant="ghost"
          size="md"
          icon="trash"
          onPress={clearAll}
          style={styles.flex}
          disabled={players.length === 0}
        />
      </View>
    </Screen>
  );
}

function IconBtn({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconBtn,
        { opacity: disabled ? 0.25 : 1, backgroundColor: pressed ? p.surfaceHigh : 'transparent' },
      ]}
    >
      <Ionicons name={icon} size={20} color={danger ? p.danger : p.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap', marginBottom: SPACE.md },
  empty: { marginVertical: SPACE.md },
  list: { gap: SPACE.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingLeft: SPACE.sm,
    minHeight: TOUCH + 8,
  },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, fontSize: 17, paddingHorizontal: SPACE.md, minHeight: TOUCH, fontWeight: '600' },
  dupText: { marginRight: 4 },
  iconBtn: { width: 40, height: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 4,
    marginTop: SPACE.md,
    gap: 4,
  },
  tools: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  flex: { flex: 1 },
  headerBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
});
