import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card, ListRow, SectionTitle } from '../../components/controls';
import { ImportSheet } from '../../components/ImportSheet';
import { toast } from '../../components/Overlay';
import { Screen } from '../../components/Screen';
import { enabledTopicIds } from '../../game';
import { useT } from '../../localization';
import { useCustomCategories, useGameConfig } from '../../state/appData';
import { buildBackup } from '../../state/backup';
import { useWordSource } from '../../state/wordSource';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { safeBack } from '../../utils/navigation';

export default function CategoriesScreen() {
  const t = useT();
  const p = usePalette();
  const custom = useCustomCategories();
  const [importing, setImporting] = useState(false);
  const config = useGameConfig();
  const source = useWordSource();
  // Same count the topic picker shows.
  const enabledCount = enabledTopicIds(config, source.categories).length;

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

      {/* Which topics a game uses is chosen in one place: the topic picker. */}
      <SectionTitle hint={t('categories.subtitle')}>{t('categories.poolTitle')}</SectionTitle>
      <Card style={styles.builtIn}>
        <ListRow
          icon="checkbox-outline"
          label={t('category.poolEdit')}
          hint={t('topics.onCount', { on: enabledCount, total: source.categories.length })}
          onPress={() => router.push('/setup/category')}
          testID="categories-topics"
        />
      </Card>

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
  flex: { flex: 1 },
});
