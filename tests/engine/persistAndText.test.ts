import { decodeSave, encodeSave, validateGameState } from '../../src/game/engine/persist';
import { sanitizeConfig, DEFAULT_GAME_CONFIG, gameReducer, createInitialState, isGuessCorrect } from '../../src/game';
import { cleanText, clampLength, charLength, guessKey } from '../../src/game/engine/text';
import { apply, config, makePlayers, startGame } from '../helpers';

describe('save / load of an active game', () => {
  const key = 'k3y-for-tests-0123456789abcdef';

  it('round-trips and never stores the secret word in readable form', () => {
    const s = startGame(makePlayers(5), config());
    const payload = encodeSave(s, key);
    expect(payload).not.toContain(s.round!.setup.word.word);
    expect(payload).not.toContain('imposter');
    expect(decodeSave(payload, key)).toEqual(s);
  });

  it('round-trips unicode and emoji names', () => {
    const players = [
      { id: 'a', name: 'प्रिया' },
      { id: 'b', name: '😎 Arun' },
      { id: 'c', name: 'Zoë' },
    ];
    const s = startGame(players, config());
    expect(decodeSave(encodeSave(s, key), key)!.players).toEqual(players);
  });

  it('returns null for corrupted, truncated, wrong-key or garbage payloads', () => {
    const payload = encodeSave(startGame(makePlayers(4), config()), key);
    expect(decodeSave(payload.slice(0, payload.length / 2), key)).toBeNull();
    expect(decodeSave(payload, 'other-key')).toBeNull();
    expect(decodeSave('%%%not base64%%%', key)).toBeNull();
    expect(decodeSave('', key)).toBeNull();
  });

  it('rejects structurally inconsistent states', () => {
    const s = startGame(makePlayers(4), config());
    expect(validateGameState({ ...s, phase: 'NOPE' })).toBeNull();
    expect(validateGameState({ ...s, players: s.players.slice(0, 2) })).toBeNull();
    expect(validateGameState({ ...s, round: { ...s.round!, revealIndex: 99 } })).toBeNull();
    expect(validateGameState({ ...s, phase: 'VOTING' })).toBeNull(); // VOTING without voting state
    expect(validateGameState(null)).toBeNull();
    expect(validateGameState(42)).toBeNull();
  });

  it('restoring a visible secret lands on the pass-the-phone gate', () => {
    let s = apply(startGame(makePlayers(4), config()), { type: 'BEGIN_REVEAL' });
    s = apply(s, { type: 'SHOW_SECRET', index: 0 });
    expect(s.phase).toBe('ROLE_REVEAL');
    const restored = gameReducer(createInitialState(), {
      type: 'RESTORE',
      state: decodeSave(encodeSave(s, key), key)!,
    });
    expect(restored.phase).toBe('ROLE_REVEAL_INTRO');
    expect(restored.round!.revealIndex).toBe(0);
  });
});

describe('config sanitising', () => {
  it('falls back to defaults for garbage', () => {
    expect(sanitizeConfig(null)).toEqual(DEFAULT_GAME_CONFIG);
    expect(sanitizeConfig('x')).toEqual(DEFAULT_GAME_CONFIG);
    const cfg = sanitizeConfig({
      mode: 'evil',
      imposterCount: 99,
      discussionTimerSec: 7,
      scoring: { imposterGuess: -5 },
    });
    expect(cfg.mode).toBe('classic');
    expect(cfg.imposterCount).toBe(1);
    expect(cfg.discussionTimerSec).toBe(DEFAULT_GAME_CONFIG.discussionTimerSec);
    expect(cfg.scoring.imposterGuess).toBe(5);
  });

  it('keeps valid values', () => {
    const cfg = sanitizeConfig({ ...DEFAULT_GAME_CONFIG, mode: 'chaos', imposterCount: 3, clueTimerSec: 45 });
    expect(cfg.mode).toBe('chaos');
    expect(cfg.imposterCount).toBe(3);
    expect(cfg.clueTimerSec).toBe(45);
  });
});

describe('text helpers', () => {
  it('cleans and clamps names (emoji-safe)', () => {
    expect(cleanText('  Raghav   V  ')).toBe('Raghav V');
    expect(clampLength('😀😀😀', 2)).toBe('😀😀');
    expect(charLength('👍🏽')).toBeGreaterThanOrEqual(1);
  });

  it.each([
    ['pizza', 'Pizza', true],
    ['  PIZZA ', 'Pizza', true],
    ['Pizzas', 'Pizza', true],
    ['Piza', 'Pizza', true],
    ['the dark knight', 'The Dark Knight', true],
    ['Hot-Dog', 'Hot Dog', true],
    ['Burger', 'Pizza', false],
    ['', 'Pizza', false],
    ['Cat', 'Car', false],
    ['Shah Rukh Kahn', 'Shah Rukh Khan', true],
  ])('guess %p vs %p → %p', (guess, secret, expected) => {
    expect(isGuessCorrect(guess, secret)).toBe(expected);
  });

  it('guessKey strips punctuation and leading "the"', () => {
    expect(guessKey('The A-Team!')).toBe('ateam');
  });
});
