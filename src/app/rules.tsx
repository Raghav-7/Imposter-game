import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { FadeIn } from '../components/anim';
import { Card } from '../components/controls';
import { Screen } from '../components/Screen';
import { type TranslationKey, useT } from '../localization';
import { SPACE } from '../theme';
import { safeBack } from '../utils/navigation';

const SECTIONS = [
  'basics',
  'example',
  'classic',
  'blind',
  'undercover',
  'multi',
  'chaos',
  'voting',
  'tie',
  'guess',
  'roles',
  'scoring',
  'tips',
] as const;

export default function RulesScreen() {
  const t = useT();
  return (
    <Screen title={t('rules.title')} onBack={() => safeBack()}>
      <View style={styles.list}>
        {SECTIONS.map((key, i) => (
          <FadeIn key={key} delay={Math.min(i, 6) * 40}>
            <Card tone={key === 'example' ? 'primary' : 'default'} style={styles.card}>
              <AppText variant="heading" accessibilityRole="header">
                {t(`rules.${key}.title` as TranslationKey)}
              </AppText>
              <AppText variant="body" tone="muted">
                {t(`rules.${key}.body` as TranslationKey)}
              </AppText>
            </Card>
          </FadeIn>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.md, paddingTop: SPACE.sm },
  card: { gap: SPACE.sm },
});
