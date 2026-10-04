import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card, SectionTitle, ToggleRow } from '../../components/controls';
import { ImportSheet } from '../../components/ImportSheet';
import { toast } from '../../components/Overlay';
import { Screen } from '../../components/Screen';
import {
  BUILT_IN_CATEGORIES,
  CATEGORY_GROUPS,
  type CategoryPreset,
  presetExclusions,
  WORD_BANK,
} from '../../data/words';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { updateGameConfig, useCustomCategories, useGameConfig } from '../../state/appData';
import { buildBackup } from '../../state/backup';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { safeBack } from '../../utils/navigation';

const PRESETS: readonly CategoryPreset[] = ['all', 'everyday', 'tamil', 'pop'];

export default function CategoriesScreen() {
  const t = useT();
  const p = usePalette();
  const custom = useCustomCategories();
  const [importing, setImporting] = useState(false);
  const config = useGameConfig();
  const excluded = new Set(config.excludedCategories);
  const enabledCount = BUILT_IN_CATEGORIES.filter((c) => !excluded.has(c.id)).length;

  /** Switch a topic on/off for Random & Mixed. */
  const toggle = (id: string, on: boolean) => {
    const next = new Set(config.excludedCategories);
    if (on) next.delete(id);
    else next.add(id);
    updateGameConfig({ excludedCategories: [...next] });
  };

  const exportCategories = async () => {
    try {
      await Share.share({
        message: JSON.stringify(buildBackup({ players: false, settings: false })),
        title: t('categories.exportMessage'),
      });
    } catch {
      toast(t('common.error.generic'));
    }
  };

  return (
    <Screen title={t('categories.title')} onBack={() => safeBack()}>
      <SectionTitle>{t('category.yours')}</SectionTitle>
      {custom.length === 0 ? (
        <AppText variant="body" tone="muted" style={styles.emptyText}>
          {t('categories.emptyCustom')}
        </AppText>
      ) : (
        <View style={styles.list}>
          {custom.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push({ pathname: '/categories/[id]', params: { id: c.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${t('category.words_other', { count: c.words.length })}`}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? p.surfaceHigh : p.surface,
                  borderColor: c.words.length === 0 ? p.warning : p.border,
                },
              ]}
            >
              <AppText style={styles.emoji}>{c.emoji}</AppText>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {c.name}
                </AppText>
                <AppText variant="caption" tone={c.words.length === 0 ? 'warning' : 'muted'}>
                  {c.words.length === 0 ? t('editor.emptyWords') : t('category.words_other', { count: c.words.length })}
                </AppText>
              </View>
              <Ionicons name="create-outline" size={20} color={p.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
      <Button
        label={t('categories.new')}
        icon="add"
        onPress={() => router.push({ pathname: '/categories/[id]', params: { id: 'new' } })}
        style={styles.newBtn}
        testID="categories-new"
      />
      <View style={styles.tools}>
        <Button
          label={t('categories.import')}
          icon="download-outline"
          variant="ghost"
          size="md"
          style={styles.flex}
          onPress={() => setImporting(true)}
        />
        <Button
          label={t('categories.export')}
          icon="share-outline"
          variant="ghost"
          size="md"
          style={styles.flex}
          onPress={exportCategories}
          disabled={custom.length === 0}
        />
      </View>

      {custom.length > 0 ? (
        <Card style={[styles.builtIn, styles.gapTop]}>
          <ToggleRow
            icon="🎲"
            label={t('categories.customInRandom')}
            value={config.customInRandom}
            onChange={(v) => updateGameConfig({ customInRandom: v })}
          />
        </Card>
      ) : null}

      <SectionTitle hint={t('categories.poolHint')}>{t('categories.poolTitle')}</SectionTitle>
      <View style={styles.presetRow} accessibilityLabel={t('categories.presets')}>
        {PRESETS.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => {
              haptic('select');
              updateGameConfig({ excludedCategories: presetExclusions(preset) });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('categories.presets')}: ${t(`categories.preset.${preset}`)}`}
            testID={`preset-${preset}`}
            style={({ pressed }) => [
              styles.preset,
              { borderColor: p.primary, backgroundColor: pressed ? p.primarySoft : 'transparent' },
            ]}
          >
            <AppText variant="bodyStrong" tone="primary">
              {t(`categories.preset.${preset}`)}
            </AppText>
          </Pressable>
        ))}
      </View>
      <AppText variant="caption" tone="muted" style={styles.count} accessibilityLiveRegion="polite">
        {t('categories.poolCount', { on: enabledCount, total: BUILT_IN_CATEGORIES.length })} ·{' '}
        {t('categories.subtitle')}
      </AppText>

      {CATEGORY_GROUPS.map((group) => (
        <View key={group}>
          <AppText variant="label" tone="faint" style={styles.groupTitle} accessibilityRole="header">
            {t(`group.${group}`)}
          </AppText>
          <Card style={styles.builtIn}>
            {BUILT_IN_CATEGORIES.filter((c) => c.group === group).map((c) => (
              <ToggleRow
                key={c.id}
                icon={c.emoji}
                label={t(`category.${c.id}`)}
                hint={t('category.words_other', { count: WORD_BANK[c.id]?.length ?? 0 })}
                value={!excluded.has(c.id)}
                onChange={(on) => toggle(c.id, on)}
              />
            ))}
          </Card>
        </View>
      ))}

      {importing ? <ImportSheet onClose={() => setImporting(false)} includePlayersAndSettings={false} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyText: { marginBottom: SPACE.sm },
  list: { gap: SPACE.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACE.md,
    minHeight: 60,
  },
  emoji: { fontSize: 26, lineHeight: 32 },
  newBtn: { marginTop: SPACE.md },
  tools: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  builtIn: { paddingVertical: SPACE.xs, paddingHorizontal: SPACE.xs },
  gapTop: { marginTop: SPACE.md },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  preset: {
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.lg,
    minHeight: 40,
    justifyContent: 'center',
  },
  count: { marginTop: SPACE.sm },
  groupTitle: { marginTop: SPACE.lg, marginBottom: SPACE.xs },
  flex: { flex: 1 },
});
