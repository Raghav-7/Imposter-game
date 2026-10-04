/**
 * Synthesises every sound effect and the music loop as small mono WAV files.
 * All audio is generated from scratch (no samples), so it is fully original.
 *
 *   node scripts/generate-sounds.js
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(OUT, { recursive: true });

function writeWav(name, samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = peak > 0.95 ? 0.95 / peak : 1;
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * gain)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.concat([header, data]));
  console.log(`${name}.wav  ${((44 + data.length) / 1024).toFixed(1)} KB`);
}

const TAU = Math.PI * 2;
let seed = 1234567;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};
const sine = (f, t) => Math.sin(TAU * f * t);
const tri = (f, t) => (2 / Math.PI) * Math.asin(Math.sin(TAU * f * t));
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const note = (n) => 440 * Math.pow(2, (n - 69) / 12);

function render(duration, rate, fn) {
  const n = Math.floor(duration * rate);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / rate, i);
  // 5 ms fade-out to avoid clicks
  const fade = Math.floor(rate * 0.005);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

const R = 22050;

// UI click: tiny, soft "tock"
writeWav(
  'click',
  render(0.06, R, (t) => 0.5 * sine(1250 - t * 4000, t) * env(t, 0.002, 0.012)),
  R,
);

// Countdown tick
writeWav(
  'tick',
  render(0.08, R, (t) => 0.45 * (sine(880, t) + 0.3 * sine(1760, t)) * env(t, 0.002, 0.02)),
  R,
);

// Timer finished: friendly two-tone buzz
writeWav(
  'buzz',
  render(0.5, R, (t) => {
    const f = t < 0.22 ? 523 : 392;
    const local = t < 0.22 ? t : t - 0.22;
    return 0.4 * (tri(f, t) + 0.25 * sine(f * 2, t)) * env(local, 0.01, 0.12);
  }),
  R,
);

// Vote locked: bubbly pop with pitch drop
writeWav(
  'vote',
  render(0.14, R, (t) => 0.6 * sine(700 * Math.exp(-t * 18) + 220, t) * env(t, 0.003, 0.04)),
  R,
);

// Secret reveal: airy whoosh into a sparkly chime
writeWav(
  'reveal',
  render(0.75, R, (t) => {
    const whoosh = noise() * 0.18 * Math.sin(Math.PI * Math.min(1, t / 0.3)) * (t < 0.3 ? 1 : 0);
    const sweep = 0.2 * sine(300 + t * 1600, t) * (t < 0.28 ? t / 0.28 : 0);
    const ct = t - 0.25;
    const chime =
      ct > 0 ? 0.45 * (sine(1318.5, ct) + 0.5 * sine(1975.5, ct) + 0.25 * sine(2637, ct)) * env(ct, 0.004, 0.18) : 0;
    return whoosh + sweep + chime;
  }),
  R,
);

// Suspense: low pulse with a rising drum roll
writeWav(
  'suspense',
  render(1.8, R, (t) => {
    const p = t / 1.8;
    const drone = 0.35 * (sine(55 + p * 30, t) + 0.6 * sine(110 + p * 60, t)) * (0.6 + 0.4 * sine(4 + p * 10, t));
    const rollRate = 8 + p * 22;
    const phase = (t * rollRate) % 1;
    const roll = noise() * 0.35 * p * Math.exp(-phase * 14);
    return (drone + roll) * Math.min(1, t / 0.2);
  }),
  R,
);

// Imposter reveal: dramatic minor stab + boom
writeWav(
  'imposter',
  render(1.3, R, (t) => {
    const boom = 0.7 * sine(70 * Math.exp(-t * 3) + 30, t) * env(t, 0.005, 0.35);
    const chord = [note(57), note(60), note(64), note(69)].reduce((a, f) => a + tri(f, t) + 0.3 * sine(f * 2.01, t), 0);
    const stab = 0.16 * chord * env(t, 0.01, 0.45);
    const hiss = noise() * 0.08 * env(t, 0.002, 0.08);
    return boom + stab + hiss;
  }),
  R,
);

// Winner: bright arpeggio fanfare + chord
writeWav(
  'win',
  render(1.5, R, (t) => {
    const notes = [72, 76, 79, 84];
    let s = 0;
    notes.forEach((n, i) => {
      const start = i * 0.11;
      if (t >= start) {
        const lt = t - start;
        const sustain = i === notes.length - 1 ? 0.6 : 0.16;
        s += 0.3 * (tri(note(n), lt) + 0.35 * sine(note(n) * 2, lt)) * env(lt, 0.006, sustain);
      }
    });
    const ct = t - 0.45;
    if (ct > 0) s += 0.12 * [60, 64, 67, 72].reduce((a, n) => a + tri(note(n), ct), 0) * env(ct, 0.02, 0.5);
    return s;
  }),
  R,
);

// Music: mellow 8-bar loop (Am – F – C – G) with pad, pluck arpeggio and soft kick. Loops seamlessly.
const MR = 16000;
const bpm = 84;
const beat = 60 / bpm;
const bars = 8;
const chords = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];
const loopLen = bars * 4 * beat;
writeWav(
  'music',
  render(loopLen, MR, (t) => {
    const bar = Math.floor(t / (4 * beat));
    const chord = chords[bar % 4];
    const inBar = t - bar * 4 * beat;
    const padEnv = Math.min(1, inBar / 0.4) * Math.min(1, (4 * beat - inBar) / 0.3);
    const pad = 0.06 * chord.reduce((a, n) => a + sine(note(n), t) + 0.4 * tri(note(n) / 2, t), 0) * padEnv;
    const eighth = beat / 2;
    const step = Math.floor(inBar / eighth);
    const arpNotes = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 12];
    const at = inBar - step * eighth;
    const pluck = 0.09 * tri(note(arpNotes[step % 4]), at) * env(at, 0.004, 0.12);
    const bt = inBar % beat;
    const kick =
      (Math.floor(inBar / beat) % 2 === 0 ? 0.25 : 0.12) *
      sine(55 * Math.exp(-bt * 20) + 40, bt) *
      env(bt, 0.002, 0.08);
    return pad + pluck + kick;
  }),
  MR,
);
