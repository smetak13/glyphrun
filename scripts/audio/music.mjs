import { createRandom, pick, randomInt } from "../../logic/random.mjs";
import {
  SAMPLE_RATE, createBuffer, clearBuffer, renderTone, renderKick, renderSnare, renderClap, renderHat, renderCrash, renderTom,
  createReverb, createPingPong, applyLoopEffect, master,
} from "./synth.mjs";

const BARS = 32;
const SECTION = 8;

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
};

const VOICES = {
  bass: { shape: "saw", detune: [0, 7], attack: 0.003, decay: 0.16, sustain: 0.5, release: 0.04, cutoff: 360, filterEnvelope: 4, filterDecay: 0.08, resonance: 0.35, gain: 0.95 },
  bassBoss: { shape: "pulse", duty: 0.3, detune: [0, -7], attack: 0.002, decay: 0.1, sustain: 0.55, release: 0.03, cutoff: 520, filterEnvelope: 5, filterDecay: 0.06, resonance: 0.4, gain: 0.95 },
  pad: { shape: "saw", detune: [-10, 0, 10], attack: 0.14, decay: 0.5, sustain: 0.75, release: 0.5, cutoff: 1400, resonance: 0.1, gain: 0.55 },
  stab: { shape: "saw", detune: [-14, 0, 14], attack: 0.003, decay: 0.14, sustain: 0.25, release: 0.08, cutoff: 1500, filterEnvelope: 2.5, filterDecay: 0.07, resonance: 0.2, gain: 0.6 },
  arp: { shape: "pulse", duty: 0.25, attack: 0.002, decay: 0.08, sustain: 0.25, release: 0.05, cutoff: 2600, filterEnvelope: 1.5, filterDecay: 0.05, resonance: 0.2, gain: 0.6 },
  square: { shape: "pulse", duty: 0.5, detune: [0, 6], attack: 0.006, decay: 0.2, sustain: 0.7, release: 0.12, cutoff: 3600, resonance: 0.15, vibrato: { rate: 5.5, depth: 0.22, delay: 0.2 }, gain: 0.6 },
  saw: { shape: "saw", detune: [-7, 7], attack: 0.01, decay: 0.25, sustain: 0.65, release: 0.18, cutoff: 2400, filterEnvelope: 1, filterDecay: 0.15, resonance: 0.2, vibrato: { rate: 5, depth: 0.25, delay: 0.25 }, gain: 0.6 },
  pulse: { shape: "pulse", duty: 0.125, detune: [0, 5], attack: 0.004, decay: 0.18, sustain: 0.7, release: 0.12, cutoff: 4200, resonance: 0.1, vibrato: { rate: 6, depth: 0.2, delay: 0.18 }, gain: 0.65 },
  boss: { shape: "saw", detune: [-11, 0, 11], attack: 0.003, decay: 0.12, sustain: 0.8, release: 0.08, cutoff: 3400, filterEnvelope: 1.4, filterDecay: 0.1, resonance: 0.25, vibrato: { rate: 6.5, depth: 0.3, delay: 0.15 }, gain: 0.7 },
};

const DRUMS = {
  four: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", open: "" },
  synth: { kick: "x.......x.x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", open: "" },
  breakbeat: { kick: "x.....x...x.....", snare: "....x.......x..x", hat: "x.xxx.x.x.xxx.x.", open: "" },
  boss: { kick: "x...x...x...x.x.", snare: "....x.......x...", hat: "xx.xxx.xxx.xxx.x", open: "..x...x...x...x." },
};

const BASS = {
  octaves: [[0, 2, 0], [2, 2, 7], [4, 2, 0], [6, 2, 7], [8, 2, 0], [10, 2, 7], [12, 2, 0], [14, 2, 7]],
  eighths: [[0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0], [8, 2, 0], [10, 2, 0], [12, 2, 0], [14, 2, 4]],
  syncopated: [[0, 3, 0], [3, 3, 0], [6, 2, 7], [8, 3, 0], [11, 3, 0], [14, 2, 4]],
  drive: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((step) => [step, 1, step % 8 === 6 ? 7 : 0]),
  gallop: [0, 4, 8, 12].flatMap((beat) => [[beat, 2, 0], [beat + 2, 1, 0], [beat + 3, 1, beat === 12 ? 7 : 0]]),
};

const ARPS = {
  up: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3].map((tone, step) => [step, tone]),
  updown: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1].map((tone, step) => [step, tone]),
  wide: [0, 2, 1, 3, 2, 4, 3, 5, 0, 2, 1, 3, 2, 4, 3, 5].map((tone, step) => [step, tone]),
  pulse8: [0, 1, 2, 3, 4, 3, 2, 1].map((tone, index) => [index * 2, tone]),
};

const LEVEL_RHYTHMS = [
  [[0, 3], [3, 3], [6, 2], [8, 4], [12, 4]],
  [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
  [[0, 6], [6, 2], [8, 6], [14, 2]],
  [[0, 4], [4, 2], [6, 2], [8, 8]],
  [[2, 2], [4, 2], [6, 4], [10, 2], [12, 4]],
  [[0, 2], [2, 4], [6, 2], [8, 2], [10, 4], [14, 2]],
  [[0, 3], [3, 3], [6, 4], [10, 2], [12, 2], [14, 2]],
];

const BOSS_RHYTHMS = [
  [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
  [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 1], [9, 1], [10, 2], [12, 4]],
  [[0, 3], [3, 3], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
  [[0, 2], [2, 1], [3, 1], [4, 4], [8, 2], [10, 1], [11, 1], [12, 4]],
  [[0, 4], [4, 2], [6, 2], [8, 3], [11, 3], [14, 2]],
];

const ENDINGS = [
  [[0, 4], [4, 4], [8, 8]],
  [[0, 2], [2, 2], [4, 12]],
  [[0, 6], [6, 2], [8, 8]],
  [[0, 3], [3, 3], [6, 10]],
];

const SLOW = [
  [[0, 8], [8, 8]],
  [[0, 6], [6, 2], [8, 8]],
  [[0, 12], [12, 4]],
  [[0, 4], [4, 4], [8, 8]],
];

const MIX = {
  kick: { gain: 1, reverb: 0.02, delay: 0, duck: 0 },
  snare: { gain: 0.6, reverb: 0.6, delay: 0, duck: 0 },
  hats: { gain: 0.5, reverb: 0.05, delay: 0, duck: 0.2 },
  bass: { gain: 0.62, reverb: 0, delay: 0, duck: 0.35 },
  pad: { gain: 0.34, reverb: 0.4, delay: 0, duck: 0.65 },
  arp: { gain: 0.24, reverb: 0.2, delay: 0.4, duck: 0.35 },
  lead: { gain: 0.42, reverb: 0.25, delay: 0.28, duck: 0 },
  harmony: { gain: 0.2, reverb: 0.3, delay: 0.2, duck: 0 },
};

function mod(value, base) {
  return ((value % base) + base) % base;
}

function degreeToMidi(base, scale, degree) {
  return base + 12 * Math.floor(degree / 7) + scale[mod(degree, 7)];
}

function isChordTone(degree, chord) {
  return [0, 2, 4].includes(mod(degree - chord, 7));
}

function snapToChord(degree, chord) {
  for (const offset of [0, -1, 1, -2, 2]) {
    if (isChordTone(degree + offset, chord)) return degree + offset;
  }
  return degree;
}

function snapToStable(degree, chord) {
  for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
    const candidate = degree + offset;
    if ([0, 2].includes(mod(candidate - chord, 7))) return candidate;
  }
  return degree;
}

function keepInRange(degree, low, high) {
  if (degree > high) return degree - 2;
  if (degree < low) return degree + 2;
  return degree;
}

function generateBar(random, rhythm, chord, start, range, { ending = false } = {}) {
  let position = start;
  const notes = rhythm.map(([step, length], index) => {
    const previous = position;
    const strong = step % 4 === 0;
    const direction = position > (range.low + range.high) / 2 ? -1 : 1;
    if (strong) position = snapToChord(position + randomInt(random, -3, 3), chord);
    else position += pick(random, [-1, 1, -1, 1, -2, 2, 1]);
    if (position === previous && index > 0) position = strong ? snapToChord(position + 2 * direction, chord) : position + direction;
    position = keepInRange(position, range.low, range.high);
    if (strong) position = snapToChord(position, chord);
    if (ending && index === rhythm.length - 1) position = snapToStable(position, chord);
    return { step, length, degree: position };
  });
  return { notes, end: position };
}

function transposeBar(bar, delta, chord) {
  return bar.notes.map((note) => ({ ...note, degree: note.step % 4 === 0 ? snapToChord(note.degree + delta, chord) : note.degree + delta }));
}

function closestDelta(from, to) {
  const delta = mod(to - from, 7);
  return delta > 3 ? delta - 7 : delta;
}

function composeTheme(random, track, progression, range) {
  const rhythms = track.boss ? BOSS_RHYTHMS : LEVEL_RHYTHMS;
  const call = generateBar(random, pick(random, rhythms), progression[0], snapToChord(range.low + 3 + randomInt(random, 0, 2), progression[0]), range);
  const answer = generateBar(random, pick(random, rhythms), progression[1], call.end, range);
  const sequence = transposeBar(call, closestDelta(progression[0], progression[2]), progression[2]);
  const firstEnding = generateBar(random, pick(random, ENDINGS), progression[3], sequence[sequence.length - 1].degree, range, { ending: true });
  const climb = generateBar(random, pick(random, rhythms), progression[2], answer.end + 2, range);
  const finalEnding = generateBar(random, pick(random, ENDINGS), progression[3], climb.end, range, { ending: true });
  const firstHalf = [call.notes, answer.notes, sequence, firstEnding.notes];
  const secondHalf = [call.notes, answer.notes, climb.notes, finalEnding.notes];
  const variation = generateBar(random, pick(random, rhythms), progression[2], answer.end + 3, range);
  const lastEnding = generateBar(random, pick(random, ENDINGS), progression[3], variation.end, range, { ending: true });
  return {
    main: [...firstHalf, ...secondHalf],
    reprise: [...firstHalf, call.notes, answer.notes, variation.notes, lastEnding.notes],
  };
}

function composeBridge(random, progression, range) {
  const bars = [];
  let position = snapToChord(range.low + 4, progression[0]);
  for (let bar = 0; bar < SECTION; bar++) {
    const chord = progression[bar % 4];
    const rhythm = bar === SECTION - 1 ? [[0, 16]] : pick(random, SLOW);
    const generated = generateBar(random, rhythm, chord, position, range, { ending: bar % 4 === 3 });
    bars.push(generated.notes);
    position = generated.end;
  }
  return bars;
}

function chordMidis(base, scale, chord, center) {
  return [0, 2, 4]
    .map((offset) => {
      let midi = degreeToMidi(base, scale, chord + offset);
      while (midi < center - 6) midi += 12;
      while (midi >= center + 6) midi -= 12;
      return midi;
    })
    .sort((a, b) => a - b);
}

function bassDegree(chord) {
  return chord >= 4 ? chord - 7 : chord;
}

function drumHit(pattern, step) {
  return pattern[step] === "x";
}

function compose(track) {
  const random = createRandom(track.seed);
  const scale = SCALES[track.scale];
  const beat = 60 / track.bpm;
  const step = beat / 4;
  const bar = beat * 4;
  const range = track.boss ? { low: 3, high: 12 } : { low: 0, high: 10 };
  const leadBase = track.root + 12;
  const theme = composeTheme(random, track, track.verse, range);
  const bridgeMelody = composeBridge(random, track.bridge, range);
  const parts = { kick: [], snare: [], hats: [], bass: [], pad: [], arp: [], lead: [], harmony: [] };
  const kicks = [];
  const drums = DRUMS[track.drums];

  for (let barIndex = 0; barIndex < BARS; barIndex++) {
    const section = Math.floor(barIndex / SECTION);
    const barInSection = barIndex % SECTION;
    const progression = section === 2 ? track.bridge : track.verse;
    const chord = progression[barInSection % 4];
    const barStart = barIndex * bar;
    const halfTime = section === 2 && barInSection < 4;
    const fill = barInSection === SECTION - 1;

    if (barInSection === 0) parts.hats.push({ kind: "crash", start: barStart, velocity: 1 });
    for (let s = 0; s < 16; s++) {
      const at = barStart + s * step;
      const inFill = fill && s >= 12;
      if (halfTime) {
        if (s === 0) {
          parts.kick.push({ start: at, velocity: 1 });
          kicks.push(at);
        }
        if (s === 8) parts.snare.push({ kind: "snare", start: at, velocity: 0.9 });
        if (s % 4 === 2) parts.hats.push({ kind: "hat", start: at, velocity: 0.5, open: track.boss });
        continue;
      }
      if (drumHit(drums.kick, s) && !(inFill && s > 12)) {
        parts.kick.push({ start: at, velocity: 1 });
        kicks.push(at);
      }
      if (inFill) {
        if (barIndex === BARS - 1 && !track.boss) parts.snare.push({ kind: "tom", start: at, midi: 52 - (s - 12) * 4, velocity: 0.9 });
        else parts.snare.push({ kind: "snare", start: at, velocity: 0.45 + (s - 12) * 0.15 });
        continue;
      }
      if (drumHit(drums.snare, s)) {
        parts.snare.push({ kind: "snare", start: at, velocity: 1 });
        if (track.drums === "synth" || track.boss) parts.snare.push({ kind: "clap", start: at, velocity: 0.6 });
      }
      if (drumHit(drums.open, s)) parts.hats.push({ kind: "hat", start: at, velocity: 0.55, open: true });
      else if (drumHit(drums.hat, s)) parts.hats.push({ kind: "hat", start: at, velocity: s % 4 === 0 ? 0.75 : 0.5 + random.next() * 0.15, open: false });
    }

    for (const [s, length, offset] of BASS[track.bass]) {
      const midi = degreeToMidi(track.root - 12, scale, bassDegree(chord) + offset);
      parts.bass.push({ start: barStart + s * step, length: length * step * 0.85, midi, velocity: s % 4 === 0 ? 1 : 0.8 });
    }

    const padNotes = chordMidis(track.root, scale, chord, track.root + 9);
    if (track.boss) {
      for (const s of [0, 3, 6, 10, 12]) {
        padNotes.forEach((midi, index) => parts.pad.push({ start: barStart + s * step, length: step * 1.5, midi, velocity: 0.8, pan: (index - 1) * 0.4, voice: "stab" }));
      }
    } else {
      padNotes.forEach((midi, index) => parts.pad.push({ start: barStart, length: bar * 0.97, midi, velocity: 0.8, pan: (index - 1) * 0.5, voice: "pad" }));
    }

    const arpTones = chordMidis(track.root + 12, scale, chord, track.root + 18);
    const tones = [...arpTones, ...arpTones.map((midi) => midi + 12)];
    const arpLift = section === 3 ? 12 : 0;
    const arpLevel = section === 0 ? 0.75 : 1;
    for (const [s, tone] of ARPS[track.arp]) {
      const length = track.arp === "pulse8" ? step * 1.6 : step * 0.8;
      parts.arp.push({ start: barStart + s * step, length, midi: tones[tone] + arpLift, velocity: arpLevel * (s % 4 === 0 ? 1 : 0.75), pan: s % 2 === 0 ? -0.4 : 0.4 });
    }

    const melodyBar = section === 1 ? theme.main[barInSection]
      : section === 2 ? bridgeMelody[barInSection]
        : section === 3 ? theme.reprise[barInSection]
          : track.boss && barInSection >= 4 ? theme.main[barInSection] : null;
    if (melodyBar) {
      for (const note of melodyBar) {
        const start = barStart + note.step * step;
        const length = note.length * step * (track.boss ? 0.8 : 0.92);
        const velocity = section === 0 ? 0.7 : 0.95;
        parts.lead.push({ start, length, midi: degreeToMidi(leadBase, scale, note.degree), velocity, pan: 0 });
        if (section === 3) parts.harmony.push({ start, length, midi: degreeToMidi(leadBase, scale, note.degree - 2), velocity: 0.8, pan: -0.35 });
      }
    }
  }

  return { parts, kicks, loopSeconds: bar * BARS, beat };
}

function renderPart(buffer, name, events, track) {
  for (const event of events) {
    if (name === "kick") renderKick(buffer, event.start, event.velocity, track.boss ? { punch: 120, low: 48, length: 0.3 } : undefined);
    else if (event.kind === "snare") renderSnare(buffer, event.start, event.velocity);
    else if (event.kind === "clap") renderClap(buffer, event.start, event.velocity);
    else if (event.kind === "tom") renderTom(buffer, event.start, event.midi, event.velocity);
    else if (event.kind === "crash") renderCrash(buffer, event.start, event.velocity);
    else if (event.kind === "hat") renderHat(buffer, event.start, event.velocity, event.open);
    else {
      const voice = name === "bass" ? VOICES[track.boss ? "bassBoss" : "bass"]
        : name === "pad" ? VOICES[event.voice]
          : name === "arp" ? VOICES.arp
            : VOICES[track.lead];
      renderTone(buffer, { start: event.start, length: event.length, midi: event.midi, voice, velocity: event.velocity, pan: event.pan || 0 });
    }
  }
}

function duckingCurve(kicks, length) {
  const curve = new Float32Array(length);
  const attack = Math.round(0.004 * SAMPLE_RATE);
  const span = Math.round(0.32 * SAMPLE_RATE);
  for (const kick of kicks) {
    const first = Math.round(kick * SAMPLE_RATE);
    for (let index = 0; index < span; index++) {
      const amount = index < attack ? index / attack : Math.exp(-(index - attack) / (0.09 * SAMPLE_RATE));
      const at = mod(first + index, length);
      curve[at] = Math.max(curve[at], amount);
    }
  }
  return curve;
}

export function renderTrack(track) {
  const { parts, kicks, loopSeconds, beat } = compose(track);
  const output = createBuffer(loopSeconds, true);
  const reverbSend = createBuffer(loopSeconds, true);
  const delaySend = createBuffer(loopSeconds, true);
  const part = createBuffer(loopSeconds, true);
  const ducking = duckingCurve(kicks, output.length);

  for (const [name, events] of Object.entries(parts)) {
    clearBuffer(part);
    renderPart(part, name, events, track);
    const mix = MIX[name];
    const gain = name === "lead" && track.boss ? mix.gain * 1.15 : mix.gain;
    for (let index = 0; index < output.length; index++) {
      const duck = 1 - mix.duck * ducking[index];
      const left = part.left[index] * gain * duck;
      const right = part.right[index] * gain * duck;
      output.left[index] += left;
      output.right[index] += right;
      reverbSend.left[index] += left * mix.reverb;
      reverbSend.right[index] += right * mix.reverb;
      delaySend.left[index] += left * mix.delay;
      delaySend.right[index] += right * mix.delay;
    }
  }

  applyLoopEffect(reverbSend, createReverb({ room: track.boss ? 0.8 : 0.86, damp: 0.3 }), output, 1.1);
  applyLoopEffect(delaySend, createPingPong(beat * 0.75, 0.38), output, 0.6);
  master(output, { targetRms: track.boss ? 0.2 : 0.17 });
  return output;
}
