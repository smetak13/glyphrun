import { SAMPLE_RATE, createBuffer, renderTone, renderSweep, renderNoise, renderKick, midiToHz, normalizePeak } from "./synth.mjs";

const CHIP = { shape: "pulse", duty: 0.5, attack: 0.002, decay: 0.06, sustain: 0.6, release: 0.04, cutoff: 6000, resonance: 0.1, gain: 0.8 };
const CHIP_THIN = { ...CHIP, duty: 0.25 };
const CHIP_BELL = { shape: "triangle", attack: 0.002, decay: 0.25, sustain: 0.3, release: 0.15, cutoff: 8000, resonance: 0, gain: 1 };
const CHIP_PAD = { shape: "saw", detune: [-8, 0, 8], attack: 0.01, decay: 0.4, sustain: 0.6, release: 0.5, cutoff: 2600, resonance: 0.1, gain: 0.6 };
const CHIP_BASS = { shape: "triangle", attack: 0.002, decay: 0.1, sustain: 0.8, release: 0.08, cutoff: 3000, resonance: 0, gain: 1 };

function crush(buffer, from, to, hold, levels) {
  const first = Math.round(from * SAMPLE_RATE);
  const last = Math.min(buffer.length, Math.round(to * SAMPLE_RATE));
  for (const channel of [buffer.left, buffer.right]) {
    let held = 0;
    for (let index = first; index < last; index++) {
      if ((index - first) % hold === 0) held = Math.round(channel[index] * levels) / levels;
      channel[index] = held;
    }
  }
}

function notes(buffer, voice, sequence, { start = 0, step, length = step * 0.9, pan = 0 } = {}) {
  sequence.forEach((midi, index) => {
    if (midi !== null) renderTone(buffer, { start: start + index * step, length, midi, voice, pan });
  });
}

const EFFECTS = {
  jump(buffer) {
    renderSweep(buffer, { start: 0, length: 0.16, fromHz: 280, toHz: 760, duty: 0.5, gain: 0.6, decay: 0.12 });
  },
  land(buffer) {
    renderSweep(buffer, { start: 0, length: 0.08, fromHz: 150, toHz: 60, shape: "triangle", gain: 0.9, decay: 0.04 });
    renderNoise(buffer, { start: 0, length: 0.05, gain: 0.25, decay: 0.015, mode: "low", cutoff: 1800 });
  },
  bit(buffer) {
    renderTone(buffer, { start: 0, length: 0.05, midi: 83, voice: CHIP_THIN });
    renderTone(buffer, { start: 0.055, length: 0.22, midi: 88, voice: { ...CHIP_THIN, decay: 0.2, sustain: 0.1 } });
  },
  sudo(buffer) {
    notes(buffer, CHIP, [60, 64, 67, 72, 76, 79, 84], { step: 0.045, length: 0.05 });
    notes(buffer, CHIP_THIN, [72, 76, 79, 84, 88, 91, 96], { start: 0.02, step: 0.045, length: 0.04 });
    renderTone(buffer, { start: 0.32, length: 0.25, midi: 84, voice: CHIP_BELL });
  },
  "one-up"(buffer) {
    notes(buffer, CHIP, [72, 76, 79, 84, 79, 84, 88], { step: 0.055, length: 0.05 });
    notes(buffer, CHIP_THIN, [84, 88, 91, 96], { start: 0.03, step: 0.11, length: 0.05, pan: 0.2 });
    renderTone(buffer, { start: 0.4, length: 0.35, midi: 91, voice: CHIP_BELL });
  },
  "already-root"(buffer) {
    notes(buffer, CHIP_BELL, [88, 91, 96], { step: 0.06, length: 0.1 });
    renderTone(buffer, { start: 0.18, length: 0.2, midi: 100, voice: CHIP_BELL });
  },
  stomp(buffer) {
    renderSweep(buffer, { start: 0, length: 0.12, fromHz: 620, toHz: 140, duty: 0.25, gain: 0.6, decay: 0.08 });
    renderNoise(buffer, { start: 0, length: 0.06, gain: 0.5, decay: 0.02, mode: "band", cutoff: 2500, resonance: 0.3 });
  },
  hit(buffer) {
    renderSweep(buffer, { start: 0, length: 0.38, fromHz: 900, toHz: 180, duty: 0.125, gain: 0.6, vibrato: { rate: 28, depth: 1.5 } });
    renderNoise(buffer, { start: 0, length: 0.1, gain: 0.4, decay: 0.03, mode: "band", cutoff: 3000 });
    crush(buffer, 0.12, 0.38, 6, 6);
  },
  death(buffer) {
    renderNoise(buffer, { start: 0, length: 0.18, gain: 0.6, decay: 0.08, mode: "band", cutoff: 1800, resonance: 0.4 });
    crush(buffer, 0, 0.18, 10, 4);
    notes(buffer, CHIP, [76, 75, 74, 73, 71, 70, 68, 67, 64, 63, 60, 59, 55, 52, 48], { start: 0.25, step: 0.07, length: 0.075 });
    renderSweep(buffer, { start: 1.3, length: 0.35, fromHz: 130, toHz: 40, shape: "triangle", gain: 0.8, decay: 0.2 });
    crush(buffer, 0.75, 1.65, 8, 8);
  },
  checkpoint(buffer) {
    notes(buffer, CHIP_THIN, [79, 86], { step: 0.09, length: 0.08 });
    renderTone(buffer, { start: 0.18, length: 0.3, midi: 91, voice: CHIP_BELL });
  },
  "level-clear"(buffer) {
    const step = 0.11;
    notes(buffer, CHIP, [72, 76, 79, 84, null, 79, 84], { step, length: step * 0.85 });
    notes(buffer, CHIP_BASS, [48, null, 55, null, 52, null, 55], { step, length: step * 1.6 });
    for (const midi of [72, 76, 79, 84]) renderTone(buffer, { start: step * 7, length: 0.7, midi, voice: CHIP_PAD, pan: 0 });
    renderTone(buffer, { start: step * 7, length: 0.7, midi: 88, voice: { ...CHIP, release: 0.3 } });
    renderTone(buffer, { start: step * 7, length: 0.7, midi: 36, voice: CHIP_BASS });
  },
  "boss-warning"(buffer) {
    for (let index = 0; index < 3; index++) {
      renderSweep(buffer, { start: index * 0.3, length: 0.13, fromHz: midiToHz(81), toHz: midiToHz(81), duty: 0.5, gain: 0.5 });
      renderSweep(buffer, { start: index * 0.3 + 0.13, length: 0.13, fromHz: midiToHz(76), toHz: midiToHz(76), duty: 0.5, gain: 0.5 });
    }
  },
  "boss-hit"(buffer) {
    renderKick(buffer, 0, 1, { punch: 160, low: 40, length: 0.5 });
    renderNoise(buffer, { start: 0, length: 0.6, gain: 0.9, decay: 0.18, mode: "low", cutoff: 2400, resonance: 0.3 });
    renderSweep(buffer, { start: 0.02, length: 0.5, fromHz: 440, toHz: 55, duty: 0.25, gain: 0.5, decay: 0.25 });
    crush(buffer, 0.05, 0.6, 12, 5);
  },
  "boss-defeat"(buffer) {
    for (let index = 0; index < 5; index++) {
      const start = index * 0.22;
      renderKick(buffer, start, 0.9 - index * 0.1, { punch: 140, low: 38, length: 0.4 });
      renderNoise(buffer, { start, length: 0.5, gain: 0.8, decay: 0.15, mode: "low", cutoff: 3000 - index * 400, seed: 11 + index });
    }
    crush(buffer, 0, 1.2, 14, 4);
    renderSweep(buffer, { start: 1.1, length: 0.9, fromHz: 1200, toHz: 60, duty: 0.125, gain: 0.5, vibrato: { rate: 18, depth: 1 } });
    crush(buffer, 1.4, 2.0, 20, 3);
    for (const midi of [64, 68, 71, 76]) renderTone(buffer, { start: 2.1, length: 1.2, midi, voice: CHIP_PAD });
    renderTone(buffer, { start: 2.1, length: 1.2, midi: 40, voice: CHIP_BASS });
  },
  "core-dump"(buffer) {
    notes(buffer, CHIP_THIN, [84, 79, 84, 79, 84], { step: 0.05, length: 0.04 });
    renderNoise(buffer, { start: 0.25, length: 0.08, gain: 0.4, decay: 0.03, mode: "high", cutoff: 4000 });
  },
  "game-over"(buffer) {
    const step = 0.24;
    notes(buffer, CHIP, [72, 71, 67, 63, 62, 60], { step, length: step * 0.9 });
    notes(buffer, CHIP_BASS, [48, 47, 44, 43, 41, 36], { step, length: step * 0.9 });
    for (const midi of [60, 63, 67]) renderTone(buffer, { start: step * 6, length: 1.1, midi, voice: CHIP_PAD });
    renderTone(buffer, { start: step * 6, length: 1.1, midi: 36, voice: CHIP_BASS });
    crush(buffer, step * 6 + 0.6, step * 6 + 1.6, 16, 6);
  },
  victory(buffer) {
    const step = 0.13;
    notes(buffer, CHIP, [67, 67, 67, 72, null, 76, 74, 76, 79, null, null, 84], { step, length: step * 0.85 });
    notes(buffer, CHIP_THIN, [64, 64, 64, 67, null, 72, 71, 72, 76, null, null, 79], { step, length: step * 0.85, pan: -0.3 });
    notes(buffer, CHIP_BASS, [48, null, 43, null, 48, null, 55, null, 53, null, 55, null], { step, length: step * 1.6 });
    for (const midi of [72, 76, 79, 84]) renderTone(buffer, { start: step * 11, length: 1.4, midi, voice: CHIP_PAD });
    renderTone(buffer, { start: step * 11, length: 1.4, midi: 36, voice: CHIP_BASS });
    renderTone(buffer, { start: step * 11, length: 1.4, midi: 96, voice: CHIP_BELL });
  },
  "weapon-get"(buffer) {
    notes(buffer, CHIP, [67, 71, 74, 79, 83, 86, 91], { step: 0.04, length: 0.045 });
    renderTone(buffer, { start: 0.28, length: 0.12, midi: 86, voice: CHIP_BELL });
    renderTone(buffer, { start: 0.4, length: 0.35, midi: 91, voice: CHIP_BELL });
  },
  "fire-duck"(buffer) {
    renderSweep(buffer, { start: 0, length: 0.09, fromHz: 520, toHz: 880, duty: 0.25, gain: 0.5, decay: 0.06 });
    renderSweep(buffer, { start: 0.07, length: 0.06, fromHz: 980, toHz: 700, duty: 0.5, gain: 0.35, decay: 0.04 });
  },
  "fire-breakpoint"(buffer) {
    renderTone(buffer, { start: 0, length: 0.05, midi: 88, voice: CHIP_THIN });
    renderSweep(buffer, { start: 0.04, length: 0.14, fromHz: 1200, toHz: 1100, shape: "triangle", gain: 0.6, decay: 0.1 });
  },
  "fire-claude"(buffer) {
    notes(buffer, CHIP_BELL, [79, 84, 88], { step: 0.05, length: 0.08 });
  },
  "fire-revert"(buffer) {
    renderSweep(buffer, { start: 0, length: 0.22, fromHz: 300, toHz: 600, duty: 0.125, gain: 0.5, vibrato: { rate: 24, depth: 2 } });
  },
  "breakpoint-hit"(buffer) {
    notes(buffer, CHIP_THIN, [91, 84], { step: 0.06, length: 0.05 });
    renderNoise(buffer, { start: 0, length: 0.05, gain: 0.25, decay: 0.02, mode: "high", cutoff: 5000 });
  },
  "menu-move"(buffer) {
    renderSweep(buffer, { start: 0, length: 0.035, fromHz: 1400, toHz: 1400, duty: 0.25, gain: 0.4 });
  },
  "menu-select"(buffer) {
    notes(buffer, CHIP_THIN, [79, 91], { step: 0.05, length: 0.05 });
  },
  pause(buffer) {
    notes(buffer, CHIP_THIN, [84, 79, 84, 79], { step: 0.06, length: 0.05 });
  },
};

export const EFFECT_NAMES = Object.keys(EFFECTS);

export function renderEffect(name) {
  const buffer = createBuffer(4);
  EFFECTS[name](buffer);
  trimSilence(buffer);
  normalizePeak(buffer, 0.9);
  return buffer;
}

function trimSilence(buffer) {
  let last = buffer.length - 1;
  while (last > 0 && Math.abs(buffer.left[last]) < 0.0005 && Math.abs(buffer.right[last]) < 0.0005) last--;
  const length = Math.min(buffer.length, last + Math.round(0.01 * SAMPLE_RATE));
  buffer.left = buffer.left.subarray(0, length);
  buffer.right = buffer.right.subarray(0, length);
  buffer.length = length;
}
