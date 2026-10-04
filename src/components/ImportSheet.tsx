import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../localization';
import { applyBackup, parseBackup } from '../state/backup';
import { RADIUS, SPACE, usePalette } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { toast } from './Overlay';

/** Paste-to-import sheet. Works fully offline: text in, data merged locally. */
/** Mount it only while open — each opening starts with an empty form. */
export function ImportSheet({
  onClose,
  includePlayersAndSettings,
}: {
  onClose: () => void;
  includePlayersAndSettings: boolean;
}) {
  const t = useT();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const paste = async () => {
    try {
      const value = await Clipboard.getStringAsync();
      if (value) setText(value);
    } catch {
      setError(t('common.error.generic'));
    }
  };

  const doImport = () => {
    const backup = parseBackup(text);
    if (!backup) {
      setError(t('categories.importInvalid'));
      return;
    }
    const res = applyBackup(backup, { players: includePlayersAndSettings, settings: includePlayersAndSettings });
    toast(
      includePlayersAndSettings
        ? t('settings.importDone', { categories: res.categories, players: res.players })
        : t('categories.importDone_other', { count: res.categories }),
    );
    onClose();
  };

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: p.overlay }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: p.scheme === 'dark' ? '#1C1730' : '#FFFFFF',
              paddingBottom: insets.bottom + SPACE.lg,
              borderColor: p.border,
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <AppText variant="title" accessibilityRole="header">
              {t('categories.importTitle')}
            </AppText>
            <AppText variant="body" tone="muted">
              {t('categories.importHint')}
            </AppText>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                setError(null);
              }}
              placeholder={t('categories.importPlaceholder')}
              placeholderTextColor={p.textFaint}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel={t('categories.importTitle')}
              style={[
                styles.input,
                { color: p.text, borderColor: error ? p.danger : p.border, backgroundColor: p.surfaceHigh },
              ]}
            />
            {error ? (
              <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
                {error}
              </AppText>
            ) : null}
            <Button
              label={t('categories.importPaste')}
              icon="clipboard"
              variant="secondary"
              size="md"
              onPress={paste}
            />
            <Button label={t('categories.importDo')} icon="download" onPress={doImport} disabled={!text.trim()} />
            <Button label={t('common.cancel')} variant="ghost" size="md" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, borderWidth: 1, maxHeight: '90%' },
  content: { padding: SPACE.xl, gap: SPACE.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  input: {
    minHeight: 140,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    textAlignVertical: 'top',
    fontSize: 14,
  },
});
