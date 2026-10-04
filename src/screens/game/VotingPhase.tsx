import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { playSound } from '../../audio/sound';
import { AppText } from '../../components/AppText';
import { FadeIn, PopIn } from '../../components/anim';
import { Button } from '../../components/Button';
import type { GameState } from '../../game/types';
import { eligibleTargets } from '../../game/voting';
import { haptic } from '../../haptics';
import { useT } from '../../localization';
import { dispatch, revealVotes } from '../../state/gameStore';
import { RADIUS, SPACE, TOUCH, usePalette } from '../../theme';
import { TIMING } from '../../utils/timing';
import { PassPhoneGate } from './PassPhoneGate';

/**
 * Secret ballot. Each voter confirms identity, picks a suspect, may change the
 * pick, then locks it in. No tallies are shown until every vote is in.
 */
export function VotingPhase({ state }: { state: GameState }) {
  const t = useT();
  const p = usePalette();
  const voting = state.round!.voting!;
  const total = voting.voters.length;
  const done = voting.voterIndex;
  const voterId = voting.voters[done];
  const voter = state.players.find((pl) => pl.id === voterId);

  const progress = (
    <View style={styles.progressWrap} accessibilityLabel={t('vote.progress', { done, total })}>
      <AppText variant="label" tone="muted" align="center">
        {voting.isRevote ? t('vote.revoteTitle') : t('vote.title')}
      </AppText>
      <View style={styles.dots}>
        {voting.voters.map((id, i) => (
          <View key={id} style={[styles.dot, { backgroundColor: i < done ? p.primary : p.border }]} />
        ))}
      </View>
      <AppText variant="bodyStrong" align="center" testID="vote-progress">
        {t('vote.progress', { done, total })}
      </AppText>
    </View>
  );

  if (done >= total) {
    return (
      <View style={styles.root}>
        {progress}
        <View style={styles.center}>
          <PopIn>
            <AppText style={styles.bigEmoji}>🗳️</AppText>
          </PopIn>
          <AppText variant="display" align="center">
            {t('vote.allIn')}
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            {t('vote.allInBody')}
          </AppText>
        </View>
        <Button
          label={t('vote.reveal')}
          icon="sparkles"
          size="xl"
          haptics="reveal"
          onPress={revealVotes}
          testID="vote-reveal"
        />
      </View>
    );
  }

  if (!voter) return null;

  // Keyed per turn: every voter starts with a closed ballot and no selection.
  return (
    <VoterTurn
      key={`${voting.isRevote}:${done}`}
      state={state}
      voter={voter}
      progress={progress}
      showLocked={done > 0}
    />
  );
}

function VoterTurn({
  state,
  voter,
  progress,
  showLocked,
}: {
  state: GameState;
  voter: { id: string; name: string };
  progress: React.ReactNode;
  showLocked: boolean;
}) {
  const t = useT();
  const p = usePalette();
  const voting = state.round!.voting!;
  const done = voting.voterIndex;
  const voterId = voter.id;
  const [ballotOpen, setBallotOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // Brief "Vote locked 🔒" confirmation for the previous voter before the next gate.
  const [justLocked, setJustLocked] = useState(showLocked && TIMING.voteLockedMs > 0);

  // A ballot left open is closed (and the pick cleared) if the app is backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        setBallotOpen(false);
        setSelected(null);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!justLocked) return;
    const id = setTimeout(() => setJustLocked(false), TIMING.voteLockedMs);
    return () => clearTimeout(id);
  }, [justLocked]);

  if (justLocked && !ballotOpen) {
    return (
      <View style={styles.root}>
        {progress}
        <View style={styles.center}>
          <PopIn>
            <AppText style={styles.bigEmoji}>🔒</AppText>
          </PopIn>
          <AppText variant="display" align="center">
            {t('vote.locked')}
          </AppText>
          <AppText variant="body" tone="muted" align="center">
            {t('vote.lockedBody')}
          </AppText>
        </View>
      </View>
    );
  }

  if (!ballotOpen) {
    return (
      <View style={styles.root}>
        {progress}
        <PassPhoneGate
          heading={t('vote.passTo')}
          name={voter.name}
          note={t('vote.secret')}
          emoji="🗳️"
          buttonLabel={t('vote.ready', { name: voter.name })}
          resetKey={`${voterId}:${done}:${voting.isRevote}`}
          onReady={() => setBallotOpen(true)}
          testID="vote-gate"
        />
      </View>
    );
  }

  const targets = eligibleTargets(voting, voter.id);
  const lock = () => {
    if (!selected) return;
    playSound('vote');
    haptic('confirm');
    // The vote advances the turn; this keyed component unmounts and the next one starts fresh.
    dispatch({ type: 'CAST_VOTE', voterId: voter.id, targetId: selected });
  };
  const selectedName = state.players.find((pl) => pl.id === selected)?.name;
  const twoCols = targets.length > 6;

  return (
    <View style={styles.root}>
      {progress}
      <FadeIn style={styles.ballot}>
        <AppText variant="title" align="center" accessibilityRole="header">
          {t('vote.chooseFor', { name: voter.name })}
        </AppText>
        {/* The list scrolls on its own so the lock-in button stays on screen, even with 20 players. */}
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={[styles.grid, twoCols && styles.gridTwo]}
          accessibilityRole="radiogroup"
        >
          {targets.map((id) => {
            const pl = state.players.find((x) => x.id === id)!;
            const isSel = selected === id;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  haptic('select');
                  setSelected(id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={pl.name}
                testID={`vote-target-${pl.name}`}
                style={[
                  styles.target,
                  twoCols && styles.targetHalf,
                  {
                    backgroundColor: isSel ? p.dangerSoft : p.surface,
                    borderColor: isSel ? p.danger : p.border,
                  },
                ]}
              >
                <Ionicons
                  name={isSel ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={isSel ? p.danger : p.textFaint}
                />
                <AppText variant="heading" numberOfLines={2} style={styles.targetName}>
                  {pl.name}
                </AppText>
                {isSel && !twoCols ? (
                  <AppText variant="caption" tone="danger" style={styles.selectedTag}>
                    {t('vote.selected')}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </FadeIn>
      <Button
        label={selectedName ? t('vote.lockIn', { name: selectedName }) : t('vote.pick')}
        icon="lock-closed"
        variant="danger"
        disabled={!selected}
        onPress={lock}
        cooldownMs={1000}
        testID="vote-lock"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, justifyContent: 'space-between', paddingVertical: SPACE.md, gap: SPACE.md },
  progressWrap: { gap: 6 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.md },
  bigEmoji: { fontSize: 72, lineHeight: 84 },
  ballot: { flex: 1, gap: SPACE.lg, minHeight: 0 },
  listScroll: { flex: 1 },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap' },
  targetHalf: { flexBasis: '47%', flexGrow: 1, paddingHorizontal: SPACE.md, gap: SPACE.sm },
  grid: { gap: SPACE.sm },
  target: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: TOUCH + 12,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
  },
  targetName: { flex: 1 },
  selectedTag: { fontWeight: '800' },
});
