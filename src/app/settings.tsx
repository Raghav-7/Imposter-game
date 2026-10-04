import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { Card, ListRow, SectionTitle, Segmented, ToggleRow } from '../components/controls';
import { ImportSheet } from '../components/ImportSheet';
import { confirm, toast } from '../components/Overlay';
import { Screen } from '../components/Screen';
import { LANGUAGE_NAMES, useT } from '../localization';
import { buildBackup } from '../state/backup';
import { updateSettings, useSettings } from '../state/settings';
import { statsStore } from '../state/stats';
import { SPACE } from '../theme';
import { safeBack } from '../utils/navigation';

export default function SettingsScreen() {
  const t = useT();
  const s = useSettings();
  const [importing, setImporting] = useState(false);

  const exportData = async () => {
    try {
      const json = JSON.stringify(buildBackup({ players: true, settings: true }));
      await Share.share({ message: json, title: t('settings.exportShare') });
    } catch {
      toast(t('common.error.generic'));
    }
  };

  const resetStats = async () => {
    const ok = await confirm({
      title: t('settings.resetStatsTitle'),
      body: t('settings.resetStatsBody'),
      confirmLabel: t('common.reset'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) {
      statsStore.reset();
      toast(t('settings.resetStatsDone'));
    }
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen title={t('settings.title')} onBack={() => safeBack()}>
      <SectionTitle>{t('settings.appearance')}</SectionTitle>
      <View style={styles.group}>
        <AppText variant="caption" tone="muted">
          {t('settings.theme')}
        </AppText>
        <Segmented
          label={t('settings.theme')}
          value={s.theme}
          onChange={(v) => updateSettings({ theme: v })}
          options={[
            { value: 'dark', label: t('settings.theme.dark') },
            { value: 'light', label: t('settings.theme.light') },
            { value: 'system', label: t('settings.theme.system') },
          ]}
        />
        <AppText variant="caption" tone="muted" style={styles.label}>
          {t('settings.motion')}
        </AppText>
        <Segmented
          label={t('settings.motion')}
          value={s.motion}
          onChange={(v) => updateSettings({ motion: v })}
          options={[
            { value: 'system', label: t('settings.motion.system') },
            { value: 'full', label: t('settings.motion.full') },
            { value: 'reduced', label: t('settings.motion.reduced') },
          ]}
        />
        <AppText variant="caption" tone="muted" style={styles.label}>
          {t('settings.language')}
        </AppText>
        <Segmented
          label={t('settings.language')}
          value={s.language}
          onChange={(v) => updateSettings({ language: v })}
          options={[
            { value: 'system', label: t('settings.language.system') },
            { value: 'en', label: LANGUAGE_NAMES.en },
            { value: 'hi', label: LANGUAGE_NAMES.hi },
          ]}
        />
      </View>

      <SectionTitle>{t('settings.sound')}</SectionTitle>
      <Card style={styles.card}>
        <ToggleRow
          icon="🔊"
          label={t('settings.soundEffects')}
          value={s.soundEffects}
          onChange={(v) => updateSettings({ soundEffects: v })}
        />
        <ToggleRow
          icon="🎵"
          label={t('settings.music')}
          value={s.music}
          onChange={(v) => updateSettings({ music: v })}
        />
        <ToggleRow
          icon="📳"
          label={t('settings.haptics')}
          value={s.haptics}
          onChange={(v) => updateSettings({ haptics: v })}
        />
      </Card>

      <SectionTitle hint={t('settings.revealHint')}>{t('settings.gameplay')}</SectionTitle>
      <View style={styles.group}>
        <AppText variant="caption" tone="muted">
          {t('settings.revealStyle')}
        </AppText>
        <Segmented
          label={t('settings.revealStyle')}
          value={s.revealStyle}
          onChange={(v) => updateSettings({ revealStyle: v })}
          options={[
            { value: 'tap', label: t('settings.reveal.tap') },
            { value: 'hold', label: t('settings.reveal.hold') },
          ]}
        />
      </View>
      <Card style={[styles.card, styles.label]}>
        <ToggleRow
          icon="👀"
          label={t('settings.allowPeek')}
          value={s.allowPeek}
          onChange={(v) => updateSettings({ allowPeek: v })}
        />
        <ToggleRow
          icon="☀️"
          label={t('settings.keepAwake')}
          value={s.keepAwake}
          onChange={(v) => updateSettings({ keepAwake: v })}
        />
      </Card>

      <SectionTitle>{t('settings.data')}</SectionTitle>
      <Card style={styles.card}>
        <ListRow icon="share-outline" label={t('settings.exportData')} onPress={exportData} />
        <ListRow icon="download-outline" label={t('settings.importData')} onPress={() => setImporting(true)} />
        <ListRow
          icon="school-outline"
          label={t('settings.replayTutorial')}
          onPress={() => router.push('/onboarding')}
        />
        <ListRow icon="trash-outline" label={t('settings.resetStats')} onPress={resetStats} danger />
      </Card>

      <SectionTitle>{t('settings.about')}</SectionTitle>
      <Card style={styles.about}>
        <AppText variant="heading">{t('app.name')}</AppText>
        <AppText variant="caption" tone="muted">
          {t('settings.version', { version })}
        </AppText>
        <AppText variant="body" tone="muted">
          🔒 {t('settings.privacy')}
        </AppText>
      </Card>

      {importing ? <ImportSheet onClose={() => setImporting(false)} includePlayersAndSettings /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: SPACE.xs },
  label: { marginTop: SPACE.md },
  card: { paddingVertical: SPACE.xs, paddingHorizontal: SPACE.xs },
  about: { gap: SPACE.xs },
});
