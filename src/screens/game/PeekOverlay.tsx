import React, { useEffect, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { getSecretView } from '../../game/engine/secrets';
import type { GameState } from '../../game/types';
import { useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { RADIUS, SPACE, TOUCH, usePalette } from '../../theme';
import { TIMING } from '../../utils/timing';
import { useArmDelay } from '../../utils/useGuardedCallback';
import { PassPhoneGate } from './PassPhoneGate';
import { RoleCard } from './RoleCard';

type Step = { kind: 'pick' } | { kind: 'gate'; playerId: string } | { kind: 'show'; playerId: string };

/**
 * "Forgot your word?" — lets one player re-check their own card. The check is
 * logged publicly (shown in the discussion screen) to discourage snooping.
 */
/** Mounted only while open, so every peek starts fresh at the name picker. */
export function PeekOverlay({ state, onClose }: { state: GameState; onClose: () => void }) {
  const t = useT();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const armed = useArmDelay(TIMING.hideArmMs, step.kind);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') onClose();
    });
    return () => sub.remove();
  }, [onClose]);

  const alive = state.round?.alive ?? [];
  const nameOf = (id: string) => state.players.find((pl) => pl.id === id)?.name ?? '?';
  const view = step.kind === 'show' ? getSecretView(state, step.playerId) : null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View
        style={[
          styles.root,
          { backgroundColor: p.bg, paddingTop: insets.top + SPACE.md, paddingBottom: insets.bottom + SPACE.md },
        ]}
      >
        {step.kind === 'pick' ? (
          <View style={styles.body}>
            <AppText variant="title" align="center" accessibilityRole="header">
              {t('peek.title')}
            </AppText>
            <AppText variant="body" tone="muted" align="center">
              {t('peek.body')}
            </AppText>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
              {alive.map((id) => (
                <Pressable
                  key={id}
                  onPress={() => setStep({ kind: 'gate', playerId: id })}
                  accessibilityRole="button"
                  accessibilityLabel={nameOf(id)}
                  style={({ pressed }) => [
                    styles.item,
                    { backgroundColor: pressed ? p.surfaceHigh : p.surface, borderColor: p.border },
                  ]}
                >
                  <AppText variant="heading" numberOfLines={1}>
                    {nameOf(id)}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : step.kind === 'gate' ? (
          <PassPhoneGate
            heading={t('reveal.passTo')}
            name={nameOf(step.playerId)}
            note={t('reveal.lookAway')}
            buttonLabel={t('reveal.ready', { name: nameOf(step.playerId) })}
            resetKey={`peek:${step.playerId}`}
            onReady={() => {
              dispatch({ type: 'RECORD_PEEK', playerId: step.playerId });
              setStep({ kind: 'show', playerId: step.playerId });
            }}
          />
        ) : (
          <View style={styles.body}>{view ? <RoleCard view={view} /> : null}</View>
        )}
        {step.kind === 'show' ? (
          <Button
            label={t('reveal.hideAndPass')}
            icon="eye-off"
            variant="secondary"
            onPress={onClose}
            disabled={!armed}
          />
        ) : (
          <Button label={t('common.cancel')} variant="ghost" size="md" onPress={onClose} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: SPACE.lg + 2, gap: SPACE.md },
  body: { flex: 1, justifyContent: 'center', gap: SPACE.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  scroll: { flexGrow: 0, maxHeight: '70%' },
  list: { gap: SPACE.sm, marginTop: SPACE.md, paddingBottom: SPACE.md },
  item: {
    minHeight: TOUCH + 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
  },
});
