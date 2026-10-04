import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { SectionTitle } from '../../components/controls';
import { confirm, toast } from '../../components/Overlay';
import { Screen } from '../../components/Screen';
import {
  clampLength,
  cleanText,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_WORD_LENGTH,
  normalizeKey,
} from '../../game/engine/text';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import {
  cleanWordList,
  createCustomCategory,
  deleteCustomCategory,
  MAX_CUSTOM_WORDS,
  splitWordInput,
  updateCustomCategory,
  useCustomCategories,
} from '../../state/appData';
import { RADIUS, SPACE, TOUCH, usePalette } from '../../theme';
import { useGuardedCallback } from '../../utils/useGuardedCallback';
import { safeBack } from '../../utils/navigation';

const EMOJIS = ['✨', '🎉', '🏖️', '🍕', '🎓', '💼', '🏏', '🎬', '🎮', '🐶', '🌆', '❤️'];

/** Create (id = "new") or edit a custom category. */
export default function CategoryEditor() {
  const t = useT();
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const all = useCustomCategories();
  const existing = useMemo(() => all.find((c) => c.id === id), [all, id]);
  const isNew = id === 'new' || !existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '✨');
  const [words, setWords] = useState<string[]>(existing?.words ?? []);
  const [draft, setDraft] = useState('');

  const addWords = () => {
    const incoming = splitWordInput(draft).map((w) => clampLength(w, MAX_WORD_LENGTH));
    if (incoming.length === 0) return;
    const merged = cleanWordList([...words, ...incoming]);
    const added = merged.length - words.length;
    const skipped = incoming.length - added;
    if (merged.length >= MAX_CUSTOM_WORDS && added < incoming.length)
      toast(t('editor.full', { max: MAX_CUSTOM_WORDS }));
    else if (skipped > 0) toast(t('editor.duplicateWords_other', { count: skipped }));
    haptic('tap');
    setWords(merged);
    setDraft('');
  };

  const save = useGuardedCallback(() => {
    const cleanName = cleanText(name);
    if (!cleanName) {
      haptic('error');
      toast(t('editor.emptyName'));
      return;
    }
    if (words.length === 0) {
      haptic('error');
      toast(t('editor.emptyWords'));
      return;
    }
    if (isNew) createCustomCategory(cleanName, words, emoji);
    else updateCustomCategory(existing.id, { name: cleanName, words, emoji });
    haptic('success');
    safeBack('/categories');
  }, 800);

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: t('editor.delete'),
      body: t('editor.deleteConfirm', { name: existing.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) {
      deleteCustomCategory(existing.id);
      safeBack('/categories');
    }
  };

  return (
    <Screen
      title={isNew ? t('editor.newTitle') : t('editor.editTitle')}
      onBack={() => safeBack('/categories')}
      footer={
        <Button
          label={t('common.save')}
          icon="checkmark"
          onPress={save}
          disabled={!cleanText(name) || words.length === 0}
          testID="editor-save"
        />
      }
    >
      <SectionTitle>{t('editor.name')}</SectionTitle>
      <TextInput
        value={name}
        onChangeText={(v) => setName(clampLength(v, MAX_CATEGORY_NAME_LENGTH))}
        placeholder={t('editor.namePlaceholder')}
        placeholderTextColor={p.textFaint}
        style={[styles.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]}
        accessibilityLabel={t('editor.name')}
        maxFontSizeMultiplier={1.6}
        testID="editor-name"
      />

      <SectionTitle>{t('editor.emoji')}</SectionTitle>
      <View style={styles.emojis} accessibilityRole="radiogroup">
        {EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => setEmoji(e)}
            accessibilityRole="radio"
            accessibilityState={{ selected: emoji === e }}
            accessibilityLabel={e}
            style={[
              styles.emojiBtn,
              {
                backgroundColor: emoji === e ? p.primarySoft : p.surface,
                borderColor: emoji === e ? p.primary : p.border,
              },
            ]}
          >
            <AppText style={styles.emoji}>{e}</AppText>
          </Pressable>
        ))}
      </View>

      <SectionTitle hint={t('editor.wordsCount_other', { count: words.length })}>{t('editor.words')}</SectionTitle>
      <View style={[styles.addRow, { backgroundColor: p.surfaceHigh, borderColor: p.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addWords}
          submitBehavior="submit"
          placeholder={t('editor.addPlaceholder')}
          placeholderTextColor={p.textFaint}
          style={[styles.addInput, { color: p.text }]}
          multiline
          accessibilityLabel={t('editor.addPlaceholder')}
          maxFontSizeMultiplier={1.6}
          testID="editor-add-input"
        />
        <Button
          label={t('editor.add')}
          size="md"
          icon="add"
          onPress={addWords}
          disabled={!draft.trim()}
          cooldownMs={150}
          testID="editor-add"
        />
      </View>

      <View style={styles.chips}>
        {words.map((w) => (
          <View key={normalizeKey(w)} style={[styles.chip, { backgroundColor: p.surface, borderColor: p.border }]}>
            <AppText variant="body" style={styles.chipText}>
              {w}
            </AppText>
            <Pressable
              onPress={() => setWords(words.filter((x) => x !== w))}
              accessibilityRole="button"
              accessibilityLabel={t('editor.removeWord', { word: w })}
              hitSlop={8}
              style={styles.chipX}
            >
              <Ionicons name="close" size={16} color={p.textMuted} />
            </Pressable>
          </View>
        ))}
      </View>

      {!isNew ? (
        <Button
          label={t('editor.delete')}
          icon="trash"
          variant="ghost"
          size="md"
          onPress={remove}
          style={styles.delete}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    minHeight: TOUCH + 4,
    paddingHorizontal: SPACE.lg,
    fontSize: 17,
    fontWeight: '600',
  },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  emojiBtn: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22, lineHeight: 28 },
  addRow: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, padding: 4, gap: 4 },
  addInput: { flex: 1, minWidth: 0, fontSize: 16, paddingHorizontal: SPACE.md, minHeight: TOUCH, maxHeight: 120 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingLeft: SPACE.md,
    paddingRight: 4,
    minHeight: 40,
    maxWidth: '100%',
  },
  chipText: { flexShrink: 1 },
  chipX: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  delete: { marginTop: SPACE.xl },
});
