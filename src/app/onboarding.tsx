import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { FadeIn, PopIn } from '../components/anim';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { type TranslationKey, useT } from '../localization';
import { updateSettings } from '../state/settings';
import { RADIUS, SPACE, usePalette } from '../theme';
import { safeBack } from '../utils/navigation';

const SLIDES: { emoji: string; title: TranslationKey; body: TranslationKey }[] = [
  { emoji: '🤫', title: 'onboarding.1.title', body: 'onboarding.1.body' },
  { emoji: '🎭', title: 'onboarding.2.title', body: 'onboarding.2.body' },
  { emoji: '🗣️', title: 'onboarding.3.title', body: 'onboarding.3.body' },
  { emoji: '🕵️', title: 'onboarding.4.title', body: 'onboarding.4.body' },
];

export default function Onboarding() {
  const t = useT();
  const p = usePalette();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const last = index === SLIDES.length - 1;

  const finish = () => {
    updateSettings({ onboardingDone: true });
    if (router.canGoBack()) safeBack();
    else router.replace('/');
  };

  return (
    <Screen
      scroll={false}
      right={
        last ? null : (
          <Pressable
            onPress={finish}
            accessibilityRole="button"
            hitSlop={10}
            style={styles.skip}
            testID="onboarding-skip"
          >
            <AppText variant="bodyStrong" tone="muted">
              {t('common.skip')}
            </AppText>
          </Pressable>
        )
      }
      onBack={index > 0 ? () => setIndex(index - 1) : undefined}
      footer={
        <>
          <View style={styles.dots} accessibilityLabel={`${index + 1} / ${SLIDES.length}`}>
            {SLIDES.map((s, i) => (
              <View
                key={s.title}
                style={[
                  styles.dot,
                  { backgroundColor: i === index ? p.primary : p.border, width: i === index ? 24 : 8 },
                ]}
              />
            ))}
          </View>
          <Button
            label={last ? t('onboarding.start') : t('common.next')}
            iconRight={last ? 'play' : 'arrow-forward'}
            onPress={() => (last ? finish() : setIndex(index + 1))}
            testID="onboarding-next"
          />
        </>
      }
    >
      <View style={styles.center} key={index}>
        <PopIn>
          <View style={[styles.emojiWrap, { backgroundColor: p.primarySoft, borderColor: p.primary + '55' }]}>
            <AppText style={styles.emoji}>{slide.emoji}</AppText>
          </View>
        </PopIn>
        <FadeIn delay={80}>
          <AppText variant="display" align="center" accessibilityRole="header">
            {t(slide.title)}
          </AppText>
          <AppText variant="body" tone="muted" align="center" style={styles.body}>
            {t(slide.body)}
          </AppText>
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.xl },
  emojiWrap: {
    width: 150,
    height: 150,
    borderRadius: RADIUS.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emoji: { fontSize: 72, lineHeight: 86 },
  body: { marginTop: SPACE.md, maxWidth: 360, alignSelf: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: SPACE.sm },
  dot: { height: 8, borderRadius: 4 },
  skip: { paddingHorizontal: SPACE.md, minHeight: 48, justifyContent: 'center' },
});
