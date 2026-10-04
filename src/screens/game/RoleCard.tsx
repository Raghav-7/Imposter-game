import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import type { SecretView } from '../../game/types';
import { useT } from '../../localization';
import { RADIUS, SPACE, usePalette } from '../../theme';

/**
 * The private role card. Rendered ONLY while the owner is looking; the parent
 * unmounts it to hide, so no secret stays in the view tree.
 * An unaware undercover gets a card identical to a civilian's.
 */
export function RoleCard({ view }: { view: SecretView }) {
  const t = useT();
  const p = usePalette();
  // Every card uses identical colours, layout height and sound — someone glancing
  // across the room must not be able to tell an imposter card from a civilian one.
  const colors = p.secretBg;
  const accent = p.scheme === 'dark' ? '#B9A6FF' : p.primary;

  let title: string;
  let tip: string | null = null;
  switch (view.shownRole) {
    case 'imposter':
      title = t('reveal.imposterTitle');
      break;
    case 'undercover':
      title = t('reveal.undercoverTitle');
      break;
    case 'detective':
      title = t('role.detective.card');
      tip = t('role.detective.tip');
      break;
    case 'agent':
      title = t('role.agent.card');
      tip = t('role.agent.tip');
      break;
    case 'jester':
      title = t('role.jester.card');
      tip = t('role.jester.tip');
      break;
    default:
      title = t('role.civilian.card');
  }

  return (
    <View
      style={[styles.card, { borderColor: accent + '88' }]}
      accessible
      accessibilityLiveRegion="assertive"
      testID="role-card"
    >
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      <AppText style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
        🤫
      </AppText>
      <AppText variant="title" align="center" style={{ color: accent }} testID="role-title">
        {title}
      </AppText>

      {view.word !== null ? (
        <View style={styles.wordBlock}>
          <AppText variant="label" tone="muted" align="center">
            {t('reveal.yourWord')}
          </AppText>
          <AppText
            variant="hero"
            align="center"
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.4}
            style={styles.word}
            testID="role-word"
          >
            {view.word.toUpperCase()}
          </AppText>
          <AppText variant="caption" tone="muted" align="center">
            {t('reveal.remember')}
          </AppText>
        </View>
      ) : (
        <View style={styles.wordBlock}>
          <AppText variant="label" tone="muted" align="center">
            {t('reveal.imposterBody')}
          </AppText>
          {/* Same big-text slot as a real word, so the layout looks identical from afar. */}
          <AppText variant="hero" align="center" style={styles.word} accessibilityLabel={t('reveal.imposterBody')}>
            ? ? ?
          </AppText>
          {view.categoryHint ? (
            <View style={[styles.hint, { backgroundColor: '#00000033' }]}>
              <AppText variant="bodyStrong" align="center" testID="role-category">
                {t('reveal.categoryHint', { category: view.categoryHint })}
              </AppText>
            </View>
          ) : null}
          <AppText variant="body" tone="muted" align="center">
            {t('reveal.imposterTip')}
          </AppText>
        </View>
      )}

      {view.shownRole === 'undercover' ? (
        <AppText variant="body" tone="muted" align="center">
          {t('reveal.undercoverBody')}
        </AppText>
      ) : null}

      {view.teammateNames.length > 0 ? (
        <AppText variant="bodyStrong" align="center" style={{ color: accent }}>
          {t('reveal.teammates', { names: view.teammateNames.join(', ') })}
        </AppText>
      ) : null}

      {view.intel?.kind === 'innocent' ? (
        <AppText variant="bodyStrong" align="center">
          {t('reveal.innocent', { name: view.intel.name })}
        </AppText>
      ) : null}
      {view.intel?.kind === 'suspects' ? (
        <AppText variant="bodyStrong" align="center">
          {t('reveal.suspects', { a: view.intel.names[0], b: view.intel.names[1] })}
        </AppText>
      ) : null}
      {tip ? (
        <AppText variant="caption" tone="muted" align="center">
          {tip}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    padding: SPACE.xl,
    gap: SPACE.md,
    overflow: 'hidden',
    alignItems: 'stretch',
    minHeight: 340,
    justifyContent: 'center',
  },
  emoji: { fontSize: 56, lineHeight: 66, textAlign: 'center' },
  wordBlock: { gap: SPACE.sm, alignItems: 'center' },
  word: { marginVertical: SPACE.xs, width: '100%' },
  hint: { borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
});
