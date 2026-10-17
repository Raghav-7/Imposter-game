import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { Card } from '../../components/controls';
import type { GameState } from '../../game/types';
import { type TranslationKey, useT } from '../../localization';
import { SPACE } from '../../theme';
import { SecretWord } from './SecretWord';

/** What the odd one out had, by mode: a similar word, a word from another topic, or a question. */
function altLabel(state: GameState): TranslationKey {
  if (state.config.mode === 'questions') return 'win.imposterQuestion';
  return state.config.mode === 'lost' ? 'win.imposterWord' : 'win.undercoverWord';
}

/**
 * End of round: the secret word (and the odd one out's word) side by side, or, in Questions
 * mode, both questions one above the other.
 */
export function WordsCard({ state, testID }: { state: GameState; testID?: string }) {
  const t = useT();
  const { word, altWord } = state.round!.setup;

  if (state.config.mode === 'questions') {
    return (
      <Card tone="primary" style={styles.questions}>
        <View style={styles.question}>
          <AppText variant="label" tone="muted">
            {t('win.question')}
          </AppText>
          <AppText variant="heading" testID={testID}>
            {word.word}
          </AppText>
        </View>
        {altWord ? (
          <View style={styles.question}>
            <AppText variant="label" tone="muted">
              {t(altLabel(state))}
            </AppText>
            <AppText variant="heading">{altWord}</AppText>
          </View>
        ) : null}
      </Card>
    );
  }

  return (
    <Card tone="primary" style={styles.words}>
      <View style={styles.wordCol}>
        <AppText variant="label" tone="muted" align="center">
          {t('win.secretWord')}
        </AppText>
        <SecretWord word={word.word} size="small" testID={testID} />
        {word.categoryName ? (
          <AppText variant="caption" tone="faint" align="center">
            {word.categoryName}
          </AppText>
        ) : null}
      </View>
      {altWord ? (
        <View style={styles.wordCol}>
          <AppText variant="label" tone="muted" align="center">
            {t(altLabel(state))}
          </AppText>
          <SecretWord word={altWord} size="small" />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  words: { flexDirection: 'row', gap: SPACE.md },
  wordCol: { flex: 1, gap: 2 },
  questions: { gap: SPACE.md },
  question: { gap: 2 },
});
