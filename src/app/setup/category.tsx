import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card, SectionTitle, Segmented } from '../../components/controls';
import { Screen } from '../../components/Screen';
import {
  BUILT_IN_CATEGORIES,
  CATEGORY_GROUPS,
  MIXED_CATEGORY,
  presetExclusions,
  type CategoryPreset,
} from '../../data/words';
import { enabledTopicIds, topicsPatch } from '../../game';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { updateGameConfig, useCustomCategories, useGameConfig } from '../../state/appData';
import { useWordSource } from '../../state/wordSource';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { safeBack } from '../../utils/navigation';

const PRESETS: readonly CategoryPreset[] = ['all', 'everyday', 'tamil', 'pop'];

/** Tick any number of topics; each round draws its word from the ticked ones. */
export default function TopicPicker() {
  const t = useT();
  const p = usePalette();
  const config = useGameConfig();
  const source = useWordSource();
  const all = source.categories;
  const custom = useCustomCategories();
  const on = new Set(enabledTopicIds(config, all));
  const style = config.categoryId === MIXED_CATEGORY ? 'mixed' : 'random';

  const apply = (ids: Iterable<string>, nextStyle: 'random' | 'mixed' = style) =>
    updateGameConfig(topicsPatch(ids, all, nextStyle));

  const toggle = (id: string) => {
    haptic('select');
    const next = new Set(on);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };

  const applyPreset = (preset: CategoryPreset) => {
    haptic('select');
    const off = new Set<string>(presetExclusions(preset));
    const customOn = custom.filter((c) => on.has(c.id)).map((c) => c.id);
    apply([...BUILT_IN_CATEGORIES.filter((c) => !off.has(c.id)).map((c) => c.id), ...customOn]);
  };

  const nameOf = (id: string) => all.find((c) => c.id === id)?.name ?? id;
  const countOf = (id: string) => all.find((c) => c.id === id)?.words.length ?? 0;

  return (
    <Screen title={t('category.title')} onBack={() => safeBack('/setup/config')}>
      <Card style={styles.summary}>
        <AppText
          variant="bodyStrong"
          tone={on.size === 0 ? 'danger' : 'default'}
          accessibilityLiveRegion="polite"
          testID="topics-count"
        >
          {on.size === 0 ? t('topics.none') : t('topics.onCount', { on: on.size, total: all.length })}
        </AppText>
        <AppText variant="caption" tone="muted">
          {t('topics.tapHint')}
        </AppText>
        <View style={styles.presetRow} accessibilityLabel={t('categories.presets')}>
          {PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={t(`categories.preset.${preset}`)}
              onPress={() => applyPreset(preset)}
              testID={`topics-preset-${preset}`}
            />
          ))}
          <Chip
            label={t('topics.clear')}
            onPress={() => {
              haptic('select');
              apply([]);
            }}
            testID="topics-clear"
            muted
          />
        </View>
      </Card>

      <SectionTitle hint={t(`topics.style.${style}.hint`)}>{t('topics.eachRound')}</SectionTitle>
      <Segmented
        label={t('topics.eachRound')}
        value={style}
        onChange={(v) => apply(on, v)}
        options={[
          { value: 'random', label: t('topics.style.random') },
          { value: 'mixed', label: t('topics.style.mixed') },
        ]}
      />

      <SectionTitle>{t('category.yours')}</SectionTitle>
      <View style={styles.grid}>
        {custom.map((c) => (
          <Tile
            key={c.id}
            id={c.id}
            emoji={c.emoji}
            name={c.name}
            sub={t('category.words_other', { count: c.words.length })}
            disabled={c.words.length === 0}
            checked={on.has(c.id)}
            onToggle={toggle}
          />
        ))}
        <Pressable
          onPress={() => router.push('/categories/new')}
          accessibilityRole="button"
          accessibilityLabel={t('category.create')}
          style={({ pressed }) => [
            styles.tile,
            styles.create,
            { borderColor: p.primary, backgroundColor: pressed ? p.primarySoft : 'transparent' },
          ]}
        >
          <Ionicons name="add-circle" size={24} color={p.primary} />
          <AppText variant="bodyStrong" tone="primary" style={styles.tileText}>
            {t('category.create')}
          </AppText>
        </Pressable>
      </View>

      {CATEGORY_GROUPS.map((group) => (
        <View key={group}>
          <SectionTitle>{t(`group.${group}`)}</SectionTitle>
          <View style={styles.grid}>
            {BUILT_IN_CATEGORIES.filter((c) => c.group === group).map((c) => (
              <Tile
                key={c.id}
                id={c.id}
                emoji={c.emoji}
                name={nameOf(c.id)}
                sub={t('category.words_other', { count: countOf(c.id) })}
                checked={on.has(c.id)}
                onToggle={toggle}
              />
            ))}
          </View>
        </View>
      ))}

      <Button
        label={t('topics.done')}
        icon="checkmark"
        onPress={() => safeBack('/setup/config')}
        disabled={on.size === 0}
        style={styles.done}
        testID="topics-done"
      />
    </Screen>
  );
}

function Chip({
  label,
  onPress,
  testID,
  muted,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  muted?: boolean;
}) {
  const p = usePalette();
  const color = muted ? p.textMuted : p.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: color, backgroundColor: pressed ? p.surfaceHigh : 'transparent' },
      ]}
    >
      <AppText variant="bodyStrong" style={{ color }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Tile({
  id,
  emoji,
  name,
  sub,
  disabled,
  checked,
  onToggle,
}: {
  id: string;
  emoji: string;
  name: string;
  sub: string;
  disabled?: boolean;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={() => !disabled && onToggle(id)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={`${name}, ${sub}`}
      testID={`category-${id}`}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: checked ? p.primarySoft : pressed ? p.surfaceHigh : p.surface,
          borderColor: checked ? p.primary : p.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <AppText style={styles.emoji}>{emoji}</AppText>
      <View style={styles.tileText}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {sub}
        </AppText>
      </View>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? p.primary : p.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { gap: SPACE.sm },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.xs },
  chip: {
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACE.md,
    minHeight: 64,
  },
  create: { borderStyle: 'dashed' },
  emoji: { fontSize: 26, lineHeight: 32 },
  tileText: { flex: 1 },
  done: { marginTop: SPACE.lg },
});
