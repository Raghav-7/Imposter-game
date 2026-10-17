import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/controls';
import { maxVoteOut } from '../../game/engine/outcome';
import type { GameState, RoundState } from '../../game/types';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { dispatch } from '../../state/gameStore';
import { RADIUS, SPACE, TOUCH, usePalette } from '../../theme';

/**
 * How many players the coming vote puts out, from 1 to one per hidden player still at large.
 * Starts at "all of them", so most groups settle it in a single vote.
 */
export function useVoteSize(round: RoundState): { size: number; setSize: (n: number) => void; max: number } {
  const max = maxVoteOut(round);
  const [size, setSize] = useState(max);
  return { size: Math.min(size, max), setSize, max };
}

/** "Vote out at once [1 | 2 | 3]" on one row — only when more than one hidden player is left. */
export function VoteSizePicker({ size, max, onChange }: { size: number; max: number; onChange: (n: number) => void }) {
  const t = useT();
  if (max < 2) return null;
  return (
    <View style={styles.picker} accessibilityHint={t('voteSize.hint_other', { count: size })}>
      <AppText variant="bodyStrong" tone="muted" style={styles.pickerLabel} numberOfLines={2}>
        {t('voteSize.label')}
      </AppText>
      <View style={styles.pickerSegments}>
        <Segmented
          label={t('voteSize.label')}
          value={size}
          onChange={onChange}
          options={Array.from({ length: max }, (_, i) => ({
            value: i + 1,
            label: String(i + 1),
            accessibilityLabel: t('voteSize.hint_other', { count: i + 1 }),
          }))}
          testID="vote-size"
        />
      </View>
    </View>
  );
}

/**
 * "Caught someone out loud?" — for games with 2+ hidden players: the group may agree on a
 * player out loud (their role is revealed at once) and vote on the phone for the rest.
 */
export function OutLoudButton({ state }: { state: GameState }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const round = state.round!;
  if (round.eliminationsAllowed < 2) return null;
  return (
    <>
      <Button
        label={t('outLoud.button')}
        variant="ghost"
        size="md"
        icon="megaphone-outline"
        onPress={() => setOpen(true)}
        haptics={false}
        testID="out-loud"
      />
      {open ? <OutLoudSheet state={state} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function OutLoudSheet({ state, onClose }: { state: GameState; onClose: () => void }) {
  const t = useT();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const round = state.round!;
  const max = maxVoteOut(round);
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => {
    haptic('select');
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < max ? [...cur, id] : cur));
  };
  const confirm = () => {
    if (picked.length === 0) return;
    haptic('confirm');
    onClose();
    dispatch({ type: 'VOTE_OUT_LOUD', playerIds: picked });
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: p.overlay }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.surface, borderColor: p.border, paddingBottom: insets.bottom + SPACE.lg },
          ]}
          testID="out-loud-sheet"
        >
          <AppText variant="title" accessibilityRole="header">
            {t('outLoud.title')}
          </AppText>
          <AppText variant="body" tone="muted">
            {t('outLoud.body_other', { count: max })}
          </AppText>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {round.alive.map((id) => {
              const name = state.players.find((pl) => pl.id === id)?.name ?? '?';
              const on = picked.includes(id);
              return (
                <Pressable
                  key={id}
                  onPress={() => toggle(id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={name}
                  testID={`out-loud-${name}`}
                  style={[
                    styles.row,
                    { backgroundColor: on ? p.dangerSoft : p.surfaceHigh, borderColor: on ? p.danger : p.border },
                  ]}
                >
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? p.danger : p.textFaint} />
                  <AppText variant="heading" numberOfLines={1} style={styles.flex}>
                    {name}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button
            label={t('outLoud.confirm_other', { count: Math.max(1, picked.length) })}
            icon="eye"
            variant="danger"
            disabled={picked.length === 0}
            onPress={confirm}
            cooldownMs={1000}
            testID="out-loud-confirm"
          />
          <Button label={t('common.cancel')} variant="ghost" size="md" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  picker: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  pickerLabel: { flex: 1 },
  pickerSegments: { flexBasis: '48%' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACE.xl,
    gap: SPACE.md,
    maxHeight: '85%',
  },
  list: { flexGrow: 0 },
  listContent: { gap: SPACE.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: TOUCH + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: SPACE.lg,
  },
  flex: { flex: 1 },
});
