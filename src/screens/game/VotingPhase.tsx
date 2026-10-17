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
import { usePrivateScreen } from './privateScreen';

/**
 * Secret ballot. Each voter confirms identity, picks as many suspects as this vote
 * puts out (or abstains, if allowed), may change the picks, then locks them in.
 * No tallies are shown until every vote is in.
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
  const picks = voting.picks;
  const [ballotOpen, setBallotOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [abstaining, setAbstaining] = useState(false);
  // Hardware back / "leave game?" close an open ballot (and clear the picks) first.
  usePrivateScreen(ballotOpen, () => {
    setBallotOpen(false);
    setPicked([]);
    setAbstaining(false);
  });
  // Brief "Vote locked 🔒" confirmation for the previous voter before the next gate.
  const [justLocked, setJustLocked] = useState(showLocked && TIMING.voteLockedMs > 0);

  // A ballot left open is closed (and the pick cleared) if the app is backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        setBallotOpen(false);
        setPicked([]);
        setAbstaining(false);
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
          note={
            done === 0 && !voting.isRevote
              ? picks > 1
                ? t('vote.introMany', { count: picks })
                : t('vote.intro')
              : t('vote.secret')
          }
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
  const ready = abstaining || picked.length === picks;
  const toggle = (id: string) => {
    haptic('select');
    setAbstaining(false);
    // One pick works like a radio button; several are ticked and unticked, up to `picks`.
    if (picks === 1) setPicked([id]);
    else setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < picks ? [...cur, id] : cur));
  };
  const lock = () => {
    if (!ready) return;
    playSound('vote');
    haptic('confirm');
    // The vote advances the turn; this keyed component unmounts and the next one starts fresh.
    dispatch({ type: 'CAST_VOTE', voterId: voter.id, targetIds: abstaining ? [] : picked });
  };
  const singleName = picks === 1 ? state.players.find((pl) => pl.id === picked[0])?.name : undefined;
  const lockLabel = abstaining
    ? t('vote.lockAbstain')
    : picks === 1
      ? singleName
        ? t('vote.lockIn', { name: singleName })
        : t('vote.pick')
      : ready
        ? t('vote.lockMany', { count: picks })
        : t('vote.pickMore_other', { count: picks - picked.length });
  const twoCols = targets.length > 6;
  const mark = (on: boolean) =>
    picks === 1 ? (on ? 'radio-button-on' : 'radio-button-off') : on ? 'checkbox' : 'square-outline';

  return (
    <View style={styles.root}>
      {progress}
      <FadeIn style={styles.ballot}>
        <View style={styles.ballotHead}>
          <AppText variant="title" align="center" accessibilityRole="header">
            {picks > 1
              ? t('vote.chooseMany', { name: voter.name, count: picks })
              : t('vote.chooseFor', { name: voter.name })}
          </AppText>
          {picks > 1 ? (
            <AppText variant="bodyStrong" tone="muted" align="center" testID="vote-picked">
              {t('vote.pickedCount', { done: abstaining ? 0 : picked.length, total: picks })}
            </AppText>
          ) : null}
        </View>
        {/* The list scrolls on its own so the lock-in button stays on screen, even with 20 players. */}
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={[styles.grid, twoCols && styles.gridTwo]}
          accessibilityRole={picks === 1 ? 'radiogroup' : undefined}
        >
          {targets.map((id) => {
            const pl = state.players.find((x) => x.id === id)!;
            const isSel = picked.includes(id);
            return (
              <Pressable
                key={id}
                onPress={() => toggle(id)}
                accessibilityRole={picks === 1 ? 'radio' : 'checkbox'}
                accessibilityState={picks === 1 ? { selected: isSel } : { checked: isSel }}
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
                <Ionicons name={mark(isSel)} size={22} color={isSel ? p.danger : p.textFaint} />
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
          {voting.allowAbstain ? (
            <Pressable
              onPress={() => {
                haptic('select');
                setPicked([]);
                setAbstaining(true);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: abstaining }}
              accessibilityLabel={`${t('vote.abstain')}. ${t('vote.abstainHint')}`}
              testID="vote-abstain"
              style={[
                styles.target,
                styles.abstain,
                twoCols && styles.abstainWide,
                {
                  backgroundColor: abstaining ? p.surfaceHigh : 'transparent',
                  borderColor: abstaining ? p.textMuted : p.border,
                },
              ]}
            >
              <Ionicons
                name={abstaining ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={abstaining ? p.text : p.textFaint}
              />
              <View style={styles.targetName}>
                <AppText variant="heading">{t('vote.abstain')}</AppText>
                <AppText variant="caption" tone="muted">
                  {t('vote.abstainHint')}
                </AppText>
              </View>
            </Pressable>
          ) : null}
        </ScrollView>
      </FadeIn>
      <Button
        label={lockLabel}
        icon="lock-closed"
        variant="danger"
        disabled={!ready}
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
  ballotHead: { gap: SPACE.xs },
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
  abstain: { borderStyle: 'dashed' },
  abstainWide: { flexBasis: '100%' },
  selectedTag: { fontWeight: '800' },
});
