import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenCapture from 'expo-screen-capture';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';

import { setMusicWanted } from '../audio/sound';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { confirm } from '../components/Overlay';
import { Screen } from '../components/Screen';
import { isInGame, SENSITIVE_PHASES } from '../game/engine/stateMachine';
import type { Phase } from '../game/types';
import { useT } from '../localization';
import { dispatch, exitGame, getGameState, useGameState } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { SPACE } from '../theme';
import { logger } from '../utils/logger';
import { CluePhase, RevealCompletePhase } from '../screens/game/CluePhase';
import { DealPhase } from '../screens/game/DealPhase';
import { DiscussionPhase } from '../screens/game/DiscussionPhase';
import { EliminationPhase } from '../screens/game/EliminationPhase';
import { GuessPhase } from '../screens/game/GuessPhase';
import { PeekOverlay } from '../screens/game/PeekOverlay';
import { GameCompletePhase, goHome, RoundResultPhase, ScoreboardPhase } from '../screens/game/ResultPhases';
import { RevealPhase } from '../screens/game/RevealPhase';
import { VoteResultPhase } from '../screens/game/VoteResultPhase';
import { AnswerPhase, SimpleStartPhase } from '../screens/game/SimplePhases';
import { VotingPhase } from '../screens/game/VotingPhase';

const QUIET_PHASES: readonly Phase[] = ['CLUE_PHASE', 'DISCUSSION'];
const KEEP_AWAKE_TAG = 'imposter-game';
const CAPTURE_KEY = 'imposter-secret';

/**
 * The whole in-game flow lives on this one route and is driven purely by the
 * state machine — there are no URLs for individual phases, so navigation can
 * never skip a step or reopen a previous player's secret.
 */
export default function GameRoute() {
  const t = useT();
  const state = useGameState();
  const settings = useSettings();
  const [peekFor, setPeekFor] = useState<string | null>(null);
  const phase = state.phase;
  const active = isInGame(phase);
  // The peek overlay only exists during clues/discussion; leaving those phases closes it.
  const peekContext = `${state.round?.id}:${phase}:${state.round?.eliminations.length}:${state.round?.clueRound}`;
  const simple = state.config.playStyle === 'simple';
  // In words-only style the phone sits face down here while everyone talks.
  const talkingOutLoud = simple && phase === 'REVEAL_COMPLETE';
  const peekPhase = phase === 'CLUE_PHASE' || phase === 'DISCUSSION' || talkingOutLoud;
  const peekVisible = peekFor === peekContext && peekPhase;
  const sensitive = SENSITIVE_PHASES.includes(phase) || peekVisible;

  const leave = useCallback(async () => {
    // Never leave a secret visible behind the dialog.
    if (getGameState().phase === 'ROLE_REVEAL') dispatch({ type: 'HIDE_SECRET' });
    setPeekFor(null);
    const ok = await confirm({
      title: t('game.leaveTitle'),
      body: t('game.leaveBody'),
      confirmLabel: t('game.leaveConfirm'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) {
      exitGame();
      goHome();
    }
  }, [t]);

  // Hardware back: never navigates away silently and never exposes a secret.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (peekVisible) {
        setPeekFor(null);
        return true;
      }
      const current = getGameState().phase;
      if (current === 'ROLE_REVEAL') {
        dispatch({ type: 'HIDE_SECRET' });
        return true;
      }
      if (!isInGame(current)) return false;
      if (current === 'GAME_COMPLETE' || current === 'ANSWER') {
        exitGame();
        goHome();
        return true;
      }
      void leave();
      return true;
    });
    return () => sub.remove();
  }, [leave, peekVisible]);

  // Keep the screen on during a game (prevents the phone locking mid-discussion).
  useEffect(() => {
    // While the phone is down in words-only style, let it sleep normally.
    if (!active || !settings.keepAwake || talkingOutLoud) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [active, settings.keepAwake, talkingOutLoud]);

  // Block screenshots / recents thumbnails while secrets could be on screen.
  useEffect(() => {
    if (Platform.OS === 'web' || !sensitive) return;
    ScreenCapture.preventScreenCaptureAsync(CAPTURE_KEY).catch((e) =>
      logger.warn('capture block failed', { e: String(e) }),
    );
    return () => {
      ScreenCapture.allowScreenCaptureAsync(CAPTURE_KEY).catch(() => undefined);
    };
  }, [sensitive]);

  useEffect(() => {
    setMusicWanted(active && !QUIET_PHASES.includes(phase) && !talkingOutLoud);
  }, [active, phase, talkingOutLoud]);

  if (!active) {
    return (
      <Screen scroll={false}>
        <View style={styles.empty}>
          <AppText variant="title" align="center">
            {t('game.notFound')}
          </AppText>
          <Button label={t('game.goHome')} icon="home" onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const canPeek = settings.allowPeek;
  const openPeek = canPeek ? () => setPeekFor(peekContext) : undefined;
  const round = state.round;

  let body: React.ReactNode = null;
  switch (phase) {
    case 'WORD_GENERATED':
      body = <DealPhase state={state} />;
      break;
    case 'ROLE_REVEAL_INTRO':
    case 'ROLE_REVEAL':
      body = <RevealPhase state={state} />;
      break;
    case 'REVEAL_COMPLETE':
      body = simple ? <SimpleStartPhase state={state} onPeek={openPeek} /> : <RevealCompletePhase state={state} />;
      break;
    case 'CLUE_PHASE':
      body = <CluePhase state={state} onPeek={openPeek} />;
      break;
    case 'DISCUSSION':
      body = <DiscussionPhase key={`${round?.id}:${round?.eliminations.length}`} state={state} onPeek={openPeek} />;
      break;
    case 'VOTING':
      body = <VotingPhase state={state} />;
      break;
    case 'VOTE_RESULT':
      body = <VoteResultPhase key={`${round?.eliminations.length}:${round?.lastVote?.isRevote}`} state={state} />;
      break;
    case 'ELIMINATION':
      body = <EliminationPhase key={round?.eliminations.length} state={state} />;
      break;
    case 'IMPOSTER_GUESS':
      body = <GuessPhase state={state} />;
      break;
    case 'ROUND_RESULT':
      body = <RoundResultPhase state={state} />;
      break;
    case 'SCOREBOARD':
      body = <ScoreboardPhase state={state} />;
      break;
    case 'GAME_COMPLETE':
      body = <GameCompletePhase state={state} />;
      break;
    case 'ANSWER':
      body = <AnswerPhase state={state} />;
      break;
  }

  const title = phase === 'GAME_COMPLETE' ? '' : t('game.round', { round: round?.number ?? state.roundsPlayed });

  return (
    <Screen
      title={title}
      onBack={
        phase === 'GAME_COMPLETE'
          ? undefined
          : phase === 'ANSWER'
            ? () => {
                exitGame();
                goHome();
              }
            : () => void leave()
      }
      backIcon="close"
      backLabel={t('game.exit')}
      testID={`phase-${phase}`}
      scroll={phase !== 'VOTING'}
    >
      {body}
      {state.round && peekVisible ? <PeekOverlay state={state} onClose={() => setPeekFor(null)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', gap: SPACE.xl },
});
