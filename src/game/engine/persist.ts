import { ROLES } from '../roles';
import type { GameState, Phase } from '../types';
import { sanitizeConfig } from './config';
import { TRANSITIONS } from './stateMachine';

/**
 * Saved games contain secrets (word + roles). They are never written as
 * readable JSON: the payload is XOR-masked with a random per-install key and
 * base64-encoded. This is anti-peek obfuscation for a local party game, not
 * cryptographic protection.
 */
export const SAVE_VERSION = 1;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Encode(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    let cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else {
      cp = Math.min(cp, 0x10ffff);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
  }
  return out;
}

function utf8Decode(bytes: readonly number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i]!;
    let cp: number;
    if (b < 0x80) {
      cp = b;
      i += 1;
    } else if (b >> 5 === 6) {
      cp = ((b & 31) << 6) | (bytes[i + 1]! & 63);
      i += 2;
    } else if (b >> 4 === 14) {
      cp = ((b & 15) << 12) | ((bytes[i + 1]! & 63) << 6) | (bytes[i + 2]! & 63);
      i += 3;
    } else {
      cp = ((b & 7) << 18) | ((bytes[i + 1]! & 63) << 12) | ((bytes[i + 2]! & 63) << 6) | (bytes[i + 3]! & 63);
      i += 4;
    }
    if (!Number.isFinite(cp) || cp > 0x10ffff) throw new Error('bad utf8');
    out += String.fromCodePoint(cp);
  }
  return out;
}

function toBase64(bytes: readonly number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=';
    out += i + 2 < bytes.length ? B64[n & 63]! : '=';
  }
  return out;
}

function fromBase64(text: string): number[] {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => B64.indexOf(clean[i + k] ?? 'A'));
    const n = (c[0]! << 18) | (c[1]! << 12) | (c[2]! << 6) | c[3]!;
    out.push((n >> 16) & 255);
    if (i + 2 < clean.length) out.push((n >> 8) & 255);
    if (i + 3 < clean.length) out.push(n & 255);
  }
  return out;
}

function xor(bytes: readonly number[], key: string): number[] {
  const k = utf8Encode(key);
  if (k.length === 0) return bytes.slice();
  return bytes.map((b, i) => b ^ k[i % k.length]! ^ ((i * 31) % 251));
}

export function encodeSave(state: GameState, key: string): string {
  const json = JSON.stringify({ v: SAVE_VERSION, state });
  return toBase64(xor(utf8Encode(json), key));
}

/** Returns null for anything that is not a well-formed save (corrupted, tampered, old version). */
export function decodeSave(payload: string, key: string): GameState | null {
  try {
    const parsed: unknown = JSON.parse(utf8Decode(xor(fromBase64(payload), key)));
    if (!isRecord(parsed) || parsed.v !== SAVE_VERSION) return null;
    return validateGameState(parsed.state);
  } catch {
    return null;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Structural validation of a restored game; anything inconsistent is rejected. */
export function validateGameState(raw: unknown): GameState | null {
  if (!isRecord(raw)) return null;
  const phase = raw.phase as Phase;
  if (typeof phase !== 'string' || !(phase in TRANSITIONS)) return null;
  if (!Array.isArray(raw.players)) return null;
  const players = raw.players.filter(
    (p): p is { id: string; name: string } => isRecord(p) && typeof p.id === 'string' && typeof p.name === 'string',
  );
  if (players.length !== raw.players.length || players.length < 3) return null;
  const ids = players.map((p) => p.id);
  if (new Set(ids).size !== ids.length) return null;

  const round = raw.round;
  if (round !== null) {
    if (!isRecord(round) || !isRecord(round.setup)) return null;
    const setup = round.setup;
    if (!isRecord(setup.word) || typeof setup.word.word !== 'string' || !isRecord(setup.roles)) return null;
    const roles = setup.roles as Record<string, unknown>;
    if (
      Object.keys(roles).length !== ids.length ||
      !ids.every((id) => typeof roles[id] === 'string' && roles[id]! in ROLES)
    ) {
      return null;
    }
    if (!isStringArray(round.alive) || !isStringArray(round.clueOrder) || !isStringArray(setup.clueOrder)) return null;
    if (!round.alive.every((id) => ids.includes(id))) return null;
    if (typeof round.revealIndex !== 'number' || round.revealIndex < 0 || round.revealIndex > ids.length) return null;
    if (typeof round.clueIndex !== 'number' || round.clueIndex < 0 || round.clueIndex > round.clueOrder.length)
      return null;
    if (!Array.isArray(round.eliminations) || !Array.isArray(round.guesses) || !isStringArray(round.peeks)) return null;
    if (!Array.isArray(setup.guessChoices) || !Array.isArray(setup.modifiers) || !isRecord(setup.intel)) return null;
    if (round.voting !== null) {
      const v = round.voting;
      if (!isRecord(v) || !isStringArray(v.voters) || !isStringArray(v.candidates) || !isRecord(v.votes)) return null;
      if (typeof v.voterIndex !== 'number' || v.voterIndex < 0 || v.voterIndex > v.voters.length) return null;
    }
    if (phase === 'VOTING' && round.voting === null) return null;
    // Saves from before the direction feature default to clockwise.
    if (setup.direction !== 'clockwise' && setup.direction !== 'anticlockwise') setup.direction = 'clockwise';
    if (phase === 'VOTE_RESULT' && !isRecord(round.lastVote)) return null;
    if ((phase === 'ROUND_RESULT' || phase === 'SCOREBOARD') && !isRecord(round.result)) return null;
  } else if (phase !== 'IDLE' && phase !== 'GAME_COMPLETE') {
    return null;
  }

  return {
    phase,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : '',
    players,
    config: sanitizeConfig(raw.config),
    round: round as GameState['round'],
    scores: isRecord(raw.scores) ? (raw.scores as Record<string, number>) : {},
    roundsPlayed: typeof raw.roundsPlayed === 'number' ? raw.roundsPlayed : 0,
    history: Array.isArray(raw.history) ? (raw.history as GameState['history']) : [],
  };
}
