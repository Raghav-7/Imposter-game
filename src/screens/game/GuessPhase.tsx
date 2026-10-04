import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { Confetti, PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import { Card } from '../../components/controls';
import { getNextStep } from '../../game/engine/outcome';
import { clampLength, MAX_WORD_LENGTH } from '../../game/engine/text';
import type { GameState } from '../../game/types';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { RADIUS, SPACE, TOUCH, usePalette } from '../../theme';
import { PassPhoneGate } from './PassPhoneGate';

/**
 * IMPOSTER_GUESS. The word is never shown before the guess is locked in.
 * Multiple choice uses the pre-built decoys; "type" mode uses fuzzy matching
 * and the group can accept a close-enough answer.
 */
export function GuessPhase({ state }: { state: GameState }) {
  const t = useT();
  const p = usePalette();
  const round = state.round!;
  const guesserId = round.pendingGuesser!;
  const guesser = state.players.find((pl) => pl.id === guesserId);
  const guess = round.guesses.find((g) => g.playerId === guesserId);
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  const choices = round.setup.guessChoices;
  const useChoices = state.config.guessStyle === 'choice' && choices.length >= 3;
  const isUndercover = round.setup.roles[guesserId] === 'undercover';

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        setReady(false);
        setChoice(null);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!guess) return;
    playSound(guess.correct ? 'imposter' : 'win');
    haptic(guess.correct ? 'error' : 'success');
  }, [guess]);

  if (!guesser) return null;

  if (guess) {
    const step = getNextStep(state);
    return (
      <View style={styles.root}>
        {!guess.correct ? <Confetti /> : null}
        <View style={styles.center}>
          <AppText variant="body" tone="muted" align="center">
            {t('guess.youGuessed', { name: guesser.name, guess: guess.guess })}
          </AppText>
          <PopIn>
            <AppText variant="hero" align="center" tone={guess.correct ? 'danger' : 'success'} testID="guess-verdict">
              {guess.correct ? t('guess.correct') : t('guess.wrong')}
            </AppText>
          </PopIn>
          <Card tone="primary" style={styles.wordCard}>
            <AppText variant="label" tone="muted" align="center">
              {t('guess.theWordWas')}
            </AppText>
            <AppText variant="display" align="center" numberOfLines={2} adjustsFontSizeToFit>
              {round.setup.word.word.toUpperCase()}
            </AppText>
          </Card>
          {guess.acceptedByGroup ? (
            <AppText variant="caption" tone="muted" align="center">
              {t('guess.acceptedByGroup')}
            </AppText>
          ) : null}
        </View>
        <View style={styles.actions}>
          {!guess.correct && !useChoices ? (
            <Button
              label={t('guess.accept')}
              variant="ghost"
              size="md"
              icon="checkmark-done"
              onPress={() => dispatch({ type: 'ACCEPT_GUESS', playerId: guesserId })}
            />
          ) : null}
          {step.kind === 'result' ? (
            <Button
              label={t('elim.seeResults')}
              icon="trophy"
              onPress={() => dispatch({ type: 'FINISH_ROUND' })}
              testID="guess-results"
            />
          ) : null}
          {step.kind === 'continue' ? (
            <>
              <Button
                label={t('elim.discuss')}
                icon="people"
                onPress={() => dispatch({ type: 'CONTINUE_HUNT', to: 'discussion' })}
              />
              <Button
                label={t('elim.moreClues')}
                variant="secondary"
                size="md"
                icon="chatbubbles"
                onPress={() => dispatch({ type: 'CONTINUE_HUNT', to: 'clues' })}
              />
            </>
          ) : null}
        </View>
      </View>
    );
  }

  if (!ready) {
    return (
      <PassPhoneGate
        heading={t('guess.passTo')}
        name={guesser.name}
        emoji="🎯"
        buttonLabel={t('guess.ready', { name: guesser.name })}
        onReady={() => setReady(true)}
        resetKey={guesserId}
        testID="guess-gate"
      />
    );
  }

  const answer = useChoices ? choice : typed.trim();
  const submit = () => {
    if (!answer) return;
    dispatch({ type: 'SUBMIT_GUESS', playerId: guesserId, guess: answer });
  };

  return (
    <View style={styles.root}>
      <View style={styles.form}>
        <AppText variant="title" align="center" accessibilityRole="header">
          {isUndercover ? t('guess.questionUndercover') : t('guess.question')}
        </AppText>
        {useChoices ? (
          <View style={styles.choices} accessibilityRole="radiogroup">
            {choices.map((c) => {
              const sel = choice === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    haptic('select');
                    setChoice(c);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={c}
                  testID={`guess-choice-${c}`}
                  style={[
                    styles.choice,
                    { backgroundColor: sel ? p.primarySoft : p.surface, borderColor: sel ? p.primary : p.border },
                  ]}
                >
                  <Ionicons
                    name={sel ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={sel ? p.primary : p.textFaint}
                  />
                  <AppText variant="heading" style={styles.flex} numberOfLines={2}>
                    {c}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <TextInput
            value={typed}
            onChangeText={(v) => setTyped(clampLength(v, MAX_WORD_LENGTH))}
            placeholder={t('guess.placeholder')}
            placeholderTextColor={p.textFaint}
            autoFocus
            autoCorrect={false}
            autoComplete="off"
            onSubmitEditing={submit}
            returnKeyType="done"
            accessibilityLabel={t('guess.question')}
            style={[styles.input, { color: p.text, backgroundColor: p.surface, borderColor: p.primary }]}
            maxFontSizeMultiplier={1.5}
            testID="guess-input"
          />
        )}
      </View>
      <Button
        label={t('guess.submit')}
        icon="lock-closed"
        disabled={!answer}
        onPress={submit}
        cooldownMs={1200}
        haptics="confirm"
        testID="guess-submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: SPACE.md, gap: SPACE.lg },
  center: { flex: 1, justifyContent: 'center', gap: SPACE.md },
  wordCard: { gap: 4 },
  actions: { gap: SPACE.sm },
  form: { gap: SPACE.lg },
  choices: { gap: SPACE.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    paddingHorizontal: SPACE.lg,
    minHeight: TOUCH + 8,
    paddingVertical: SPACE.sm,
  },
  input: {
    borderWidth: 2,
    borderRadius: RADIUS.md,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: SPACE.lg,
    minHeight: 60,
    textAlign: 'center',
  },
  flex: { flex: 1 },
});
