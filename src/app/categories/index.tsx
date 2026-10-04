import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Card, SectionTitle } from '../../components/controls';
import { ImportSheet } from '../../components/ImportSheet';
import { toast } from '../../components/Overlay';
import { Screen } from '../../components/Screen';
import { BUILT_IN_CATEGORIES, WORD_BANK } from '../../data/words';
import { useT } from '../../localization';
import { useCustomCategories } from '../../state/appData';
import { buildBackup } from '../../state/backup';
import { RADIUS, SPACE, usePalette } from '../../theme';
import { safeBack } from '../../utils/navigation';

export default function CategoriesScreen() {
  const t = useT();
  const p = usePalette();
  const custom = useCustomCategories();
  const [importing, setImporting] = useState(false);

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

      <SectionTitle hint={t('categories.subtitle')}>{t('category.builtIn')}</SectionTitle>
      <Card style={styles.builtIn}>
        {BUILT_IN_CATEGORIES.map((c) => (
          <View key={c.id} style={styles.builtInRow}>
            <AppText style={styles.emojiSmall}>{c.emoji}</AppText>
            <AppText variant="body" style={styles.flex} numberOfLines={1}>
              {t(`category.${c.id}`)}
            </AppText>
            <AppText variant="caption" tone="muted">
              {t('category.words_other', { count: WORD_BANK[c.id]?.length ?? 0 })}
            </AppText>
          </View>
        ))}
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
  emojiSmall: { fontSize: 20, lineHeight: 26, width: 28 },
  newBtn: { marginTop: SPACE.md },
  tools: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  builtIn: { paddingVertical: SPACE.xs, gap: 2 },
  builtInRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 40 },
  flex: { flex: 1 },
});
