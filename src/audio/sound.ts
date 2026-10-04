import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { settingsStore } from '../state/settings';
import { logger } from '../utils/logger';

/**
 * Sound effects + background music. Every call is fire-and-forget and failure
 * tolerant: the game is fully playable silently, so audio errors are swallowed.
 */
const SOURCES = {
  click: require('../../assets/sounds/click.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  buzz: require('../../assets/sounds/buzz.wav'),
  vote: require('../../assets/sounds/vote.wav'),
  reveal: require('../../assets/sounds/reveal.wav'),
  suspense: require('../../assets/sounds/suspense.wav'),
  imposter: require('../../assets/sounds/imposter.wav'),
  win: require('../../assets/sounds/win.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const VOLUME: Partial<Record<SoundName, number>> = { click: 0.5, tick: 0.6 };

const players = new Map<SoundName, AudioPlayer>();
let music: AudioPlayer | null = null;
let musicWanted = false;
let appActive = true;
let audioModeSet = false;

async function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
  } catch (error) {
    logger.warn('audio mode unavailable', { error: String(error) });
  }
}

function getPlayer(name: SoundName): AudioPlayer | null {
  try {
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUME[name] ?? 0.9;
      players.set(name, p);
    }
    return p;
  } catch (error) {
    logger.warn('sound unavailable', { name, error: String(error) });
    return null;
  }
}

export function playSound(name: SoundName) {
  if (!settingsStore.get().soundEffects || !appActive) return;
  void ensureAudioMode();
  const p = getPlayer(name);
  if (!p) return;
  try {
    void Promise.resolve(p.seekTo(0))
      .then(() => p.play())
      .catch(() => undefined);
  } catch {
    // Ignore — sound is optional.
  }
}

function syncMusic() {
  const shouldPlay = musicWanted && appActive && settingsStore.get().music;
  try {
    if (shouldPlay) {
      void ensureAudioMode();
      if (!music) {
        music = createAudioPlayer(require('../../assets/sounds/music.wav'));
        music.loop = true;
        music.volume = 0.28;
      }
      if (!music.playing) music.play();
    } else if (music?.playing) {
      music.pause();
    }
  } catch (error) {
    logger.warn('music unavailable', { error: String(error) });
  }
}

/** Screens declare whether background music fits (menus yes, discussion no). */
export function setMusicWanted(wanted: boolean) {
  musicWanted = wanted;
  syncMusic();
}

export function setAppActive(active: boolean) {
  appActive = active;
  syncMusic();
}

settingsStore.subscribe(syncMusic);

/** Release native players (used on app teardown and in tests). */
export function releaseAudio() {
  players.forEach((p) => {
    try {
      p.remove();
    } catch {
      // already released
    }
  });
  players.clear();
  try {
    music?.remove();
  } catch {
    // already released
  }
  music = null;
}
