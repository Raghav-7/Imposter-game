import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { SectionTitle } from '../../components/controls';
import { Screen } from '../../components/Screen';
import { BUILT_IN_CATEGORIES, CATEGORY_GROUPS, MIXED_CATEGORY, RANDOM_CATEGORY, WORD_BANK } from '../../data/words';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { updateGameConfig, useCustomCategories, useGameConfig } from '../../state/appData';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { useGuardedCallback } from '../../utils/useGuardedCallback';
import { safeBack } from '../../utils/navigation';

export default function CategoryPicker() {
  const t = useT();
  const p = usePalette();
  const config = useGameConfig();
  const poolSummary = t('category.poolSummary', {
    on: BUILT_IN_CATEGORIES.filter((c) => !config.excludedCategories.includes(c.id)).length,
    total: BUILT_IN_CATEGORIES.length,
  });
  const custom = useCustomCategories();

  const select = useGuardedCallback((id: string) => {
    haptic('select');
    updateGameConfig({ categoryId: id });
    safeBack('/setup/config');
  }, 600);

  return (
    <Screen title={t('category.title')} onBack={() => safeBack('/setup/config')}>
      <View style={styles.grid}>
        <Tile
          id={RANDOM_CATEGORY}
          emoji="🎲"
          name={t('category.random')}
          sub={t('category.random.desc')}
          wide
          selected={config.categoryId === RANDOM_CATEGORY}
          onSelect={select}
        />
        <Tile
          id={MIXED_CATEGORY}
          emoji="🌈"
          name={t('category.mixed')}
          sub={t('category.mixed.desc')}
          wide
          selected={config.categoryId === MIXED_CATEGORY}
          onSelect={select}
        />
      </View>
      <Pressable
        onPress={() => router.push('/categories')}
        accessibilityRole="button"
        accessibilityLabel={`${poolSummary}. ${t('category.poolEdit')}`}
        style={styles.poolLink}
        testID="category-pool-edit"
      >
        <AppText variant="caption" tone="muted" style={styles.flex}>
          {poolSummary}
        </AppText>
        <AppText variant="caption" tone="primary" style={styles.poolEdit}>
          {t('category.poolEdit')} ›
        </AppText>
      </Pressable>

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
            selected={config.categoryId === c.id}
            onSelect={select}
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
                name={t(`category.${c.id}`)}
                sub={t('category.words_other', { count: WORD_BANK[c.id]?.length ?? 0 })}
                selected={config.categoryId === c.id}
                onSelect={select}
              />
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  wide: { flexBasis: '100%' },
  poolLink: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 44, marginTop: SPACE.xs },
  poolEdit: { fontWeight: '800' },
  flex: { flex: 1 },
  create: { borderStyle: 'dashed' },
  emoji: { fontSize: 26, lineHeight: 32 },
  tileText: { flex: 1 },
});

function Tile({
  id,
  emoji,
  name,
  sub,
  disabled,
  wide,
  selected,
  onSelect,
}: {
  id: string;
  emoji: string;
  name: string;
  sub: string;
  disabled?: boolean;
  wide?: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={() => !disabled && onSelect(id)}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={`${name}, ${sub}`}
      testID={`category-${id}`}
      style={({ pressed }) => [
        styles.tile,
        wide && styles.wide,
        {
          backgroundColor: selected ? p.primarySoft : pressed ? p.surfaceHigh : p.surface,
          borderColor: selected ? p.primary : p.border,
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
      {selected ? <Ionicons name="checkmark-circle" size={20} color={p.primary} /> : null}
    </Pressable>
  );
}
