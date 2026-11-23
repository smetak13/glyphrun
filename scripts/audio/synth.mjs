export const SAMPLE_RATE = 44100;

export function midiToHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function createNoise(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296) * 2 - 1;
  };
}

export function createBuffer(seconds, wrap = false) {
  const length = Math.ceil(seconds * SAMPLE_RATE);
  return { left: new Float32Array(length), right: new Float32Array(length), length, wrap };
}

export function clearBuffer(buffer) {
  buffer.left.fill(0);
  buffer.right.fill(0);
}

function panGains(pan) {
  const angle = ((pan + 1) * Math.PI) / 4;
  return [Math.cos(angle) * Math.SQRT2, Math.sin(angle) * Math.SQRT2];
}

function writer(buffer, startSeconds, pan) {
  const first = Math.round(startSeconds * SAMPLE_RATE);
  const [gainLeft, gainRight] = panGains(pan);
  const { left, right, length, wrap } = buffer;
  return (index, value) => {
    let at = first + index;
    if (wrap) at = ((at % length) + length) % length;
    else if (at < 0 || at >= length) return;
    left[at] += value * gainLeft;
    right[at] += value * gainRight;
  };
}

function polyBlep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

function waveSample(shape, phase, dt, duty) {
  if (shape === "saw") return 2 * phase - 1 - polyBlep(phase, dt);
  if (shape === "pulse") {
    const square = phase < duty ? 1 : -1;
    return square + polyBlep(phase, dt) - polyBlep((phase + 1 - duty) % 1, dt);
  }
  if (shape === "triangle") return 1 - 4 * Math.abs(phase - 0.5);
  return Math.sin(2 * Math.PI * phase);
}

export function createFilter(mode) {
  let low = 0;
  let band = 0;
  let g = 0;
  let k = 1;
  return {
    set(cutoff, resonance) {
      g = Math.tan((Math.PI * Math.min(cutoff, SAMPLE_RATE * 0.45)) / SAMPLE_RATE);
      k = 2 - 2 * Math.min(resonance, 0.96);
    },
    process(input) {
      const high = (input - (k + g) * band - low) / (1 + g * (g + k));
      const bandOut = g * high + band;
      const lowOut = g * bandOut + low;
      band = bandOut + g * high;
      low = lowOut + g * bandOut;
      if (mode === "high") return high;
      if (mode === "band") return bandOut;
      return lowOut;
    },
  };
}

function envelopeAt(t, length, voice) {
  const { attack, decay, sustain, release } = voice;
  let level;
  if (t < attack) level = t / attack;
  else if (t < attack + decay) level = 1 - (1 - sustain) * ((t - attack) / decay);
  else level = sustain;
  if (t > length) level *= Math.max(0, 1 - (t - length) / release);
  return level;
}

export function renderTone(buffer, { start, length, midi, voice, velocity = 1, pan = 0, slideTo = null }) {
  const write = writer(buffer, start, pan);
  const total = Math.ceil((length + voice.release) * SAMPLE_RATE);
  const detunes = voice.detune || [0];
  const phases = detunes.map((_, index) => (index * 0.37) % 1);
  const filter = createFilter("low");
  const baseHz = midiToHz(midi);
  const targetHz = slideTo === null ? baseHz : midiToHz(slideTo);
  const vibrato = voice.vibrato || { rate: 0, depth: 0, delay: 0 };
  const gain = (voice.gain || 1) * velocity / Math.sqrt(detunes.length);
  for (let index = 0; index < total; index++) {
    const t = index / SAMPLE_RATE;
    if (index % 32 === 0) {
      const sweep = (voice.filterEnvelope || 0) * Math.exp(-t / (voice.filterDecay || 0.2));
      filter.set(voice.cutoff * (1 + sweep), voice.resonance || 0.1);
    }
    const slide = slideTo === null ? 1 : Math.min(1, t / (voice.slideTime || 0.06));
    const vibratoAmount = t > vibrato.delay ? Math.min(1, (t - vibrato.delay) / 0.2) * vibrato.depth : 0;
    const hz = (baseHz + (targetHz - baseHz) * slide) * 2 ** ((vibratoAmount * Math.sin(2 * Math.PI * vibrato.rate * t)) / 12);
    let sample = 0;
    for (let osc = 0; osc < detunes.length; osc++) {
      const dt = (hz * 2 ** (detunes[osc] / 1200)) / SAMPLE_RATE;
      phases[osc] = (phases[osc] + dt) % 1;
      sample += waveSample(voice.shape, phases[osc], dt, voice.duty || 0.5);
    }
    write(index, filter.process(sample) * envelopeAt(t, length, voice) * gain);
  }
}

export function renderSweep(buffer, { start, length, fromHz, toHz, shape = "pulse", duty = 0.5, gain = 1, pan = 0, curve = "exp", decay = null, vibrato = null }) {
  const write = writer(buffer, start, pan);
  const total = Math.ceil(length * SAMPLE_RATE);
  let phase = 0;
  for (let index = 0; index < total; index++) {
    const t = index / SAMPLE_RATE;
    const progress = t / length;
    let hz = curve === "exp" ? fromHz * (toHz / fromHz) ** progress : fromHz + (toHz - fromHz) * progress;
    if (vibrato) hz *= 2 ** ((vibrato.depth * Math.sin(2 * Math.PI * vibrato.rate * t)) / 12);
    const dt = hz / SAMPLE_RATE;
    phase = (phase + dt) % 1;
    const fade = Math.min(1, t / 0.002, (length - t) / 0.01);
    const shapeGain = decay === null ? 1 : Math.exp(-t / decay);
    write(index, waveSample(shape, phase, dt, duty) * gain * fade * shapeGain);
  }
}

export function renderNoise(buffer, { start, length, gain = 1, decay = 0.1, mode = "high", cutoff = 6000, resonance = 0.1, pan = 0, seed = 7, attack = 0.001 }) {
  const write = writer(buffer, start, pan);
  const total = Math.ceil(length * SAMPLE_RATE);
  const noise = createNoise(seed);
  const filter = createFilter(mode);
  filter.set(cutoff, resonance);
  for (let index = 0; index < total; index++) {
    const t = index / SAMPLE_RATE;
    const fade = Math.min(1, t / attack, (length - t) / 0.005);
    write(index, filter.process(noise()) * gain * Math.exp(-t / decay) * fade);
  }
}

export function renderKick(buffer, start, velocity = 1, { punch = 105, low = 45, length = 0.42 } = {}) {
  const write = writer(buffer, start, 0);
  const total = Math.ceil(length * SAMPLE_RATE);
  const noise = createNoise(99);
  let phase = 0;
  for (let index = 0; index < total; index++) {
    const t = index / SAMPLE_RATE;
    phase += (low + punch * Math.exp(-t / 0.028)) / SAMPLE_RATE;
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.16);
    const click = t < 0.004 ? noise() * 0.4 * (1 - t / 0.004) : 0;
    const fade = Math.min(1, (length - t) / 0.01);
    write(index, Math.tanh((body + click) * 1.6) * velocity * fade);
  }
}

export function renderSnare(buffer, start, velocity = 1, pan = 0) {
  renderSweep(buffer, { start, length: 0.16, fromHz: 230, toHz: 170, shape: "triangle", gain: 0.55 * velocity, decay: 0.05, pan });
  renderNoise(buffer, { start, length: 0.32, gain: 1.1 * velocity, decay: 0.1, mode: "band", cutoff: 2200, resonance: 0.2, pan, seed: 31 });
  renderNoise(buffer, { start, length: 0.2, gain: 0.5 * velocity, decay: 0.05, mode: "high", cutoff: 6500, pan, seed: 57 });
}

export function renderClap(buffer, start, velocity = 1) {
  for (const [offset, seed] of [[0, 3], [0.011, 5], [0.022, 9]]) {
    renderNoise(buffer, { start: start + offset, length: 0.02, gain: 0.7 * velocity, decay: 0.008, mode: "band", cutoff: 1300, resonance: 0.3, seed });
  }
  renderNoise(buffer, { start: start + 0.03, length: 0.25, gain: 0.8 * velocity, decay: 0.07, mode: "band", cutoff: 1300, resonance: 0.3, seed: 13 });
}

export function renderHat(buffer, start, velocity = 1, open = false, pan = 0.25) {
  renderNoise(buffer, { start, length: open ? 0.3 : 0.06, gain: 0.55 * velocity, decay: open ? 0.12 : 0.022, mode: "high", cutoff: 8000, resonance: 0.15, pan, seed: open ? 77 : 41 });
}

export function renderCrash(buffer, start, velocity = 1) {
  renderNoise(buffer, { start, length: 2.2, gain: 0.35 * velocity, decay: 0.7, mode: "high", cutoff: 5200, resonance: 0.1, pan: -0.3, seed: 1234 });
  renderNoise(buffer, { start, length: 2.2, gain: 0.35 * velocity, decay: 0.7, mode: "high", cutoff: 5600, resonance: 0.1, pan: 0.3, seed: 4321 });
}

export function renderTom(buffer, start, midi, velocity = 1, pan = 0) {
  const hz = midiToHz(midi);
  renderSweep(buffer, { start, length: 0.32, fromHz: hz * 1.8, toHz: hz, shape: "sine", gain: 0.9 * velocity, decay: 0.12, pan });
}

function createComb(size, feedback, damp) {
  const data = new Float32Array(size);
  let index = 0;
  let store = 0;
  return (input) => {
    const output = data[index];
    store = output * (1 - damp) + store * damp;
    data[index] = input + store * feedback;
    index = (index + 1) % size;
    return output;
  };
}

function createAllpass(size) {
  const data = new Float32Array(size);
  let index = 0;
  return (input) => {
    const delayed = data[index];
    data[index] = input + delayed * 0.5;
    index = (index + 1) % size;
    return delayed - input;
  };
}

export function createReverb({ room = 0.84, damp = 0.25 } = {}) {
  const combSizes = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const allpassSizes = [556, 441, 341, 225];
  const channels = [0, 23].map((spread) => ({
    combs: combSizes.map((size) => createComb(size + spread, room, damp)),
    allpasses: allpassSizes.map((size) => createAllpass(size + spread)),
  }));
  return (left, right) => {
    const input = (left + right) * 0.015;
    return channels.map(({ combs, allpasses }) => {
      let sum = 0;
      for (const comb of combs) sum += comb(input);
      for (const allpass of allpasses) sum = allpass(sum);
      return sum;
    });
  };
}

export function createPingPong(delaySeconds, feedback = 0.38, tone = 3500) {
  const size = Math.round(delaySeconds * SAMPLE_RATE);
  const leftLine = new Float32Array(size);
  const rightLine = new Float32Array(size);
  const filterLeft = createFilter("low");
  const filterRight = createFilter("low");
  filterLeft.set(tone, 0);
  filterRight.set(tone, 0);
  let index = 0;
  return (left, right) => {
    const outLeft = leftLine[index];
    const outRight = rightLine[index];
    leftLine[index] = (left + right) * 0.5 + filterRight.process(outRight) * feedback;
    rightLine[index] = filterLeft.process(outLeft) * feedback;
    index = (index + 1) % size;
    return [outLeft, outRight];
  };
}

export function applyLoopEffect(input, effect, output, gain) {
  for (let pass = 0; pass < 2; pass++) {
    for (let index = 0; index < input.length; index++) {
      const [left, right] = effect(input.left[index], input.right[index]);
      if (pass === 1) {
        output.left[index] += left * gain;
        output.right[index] += right * gain;
      }
    }
  }
}

export function master(buffer, { targetRms = 0.17, peak = 0.95 } = {}) {
  const highLeft = createFilter("high");
  const highRight = createFilter("high");
  highLeft.set(28, 0);
  highRight.set(28, 0);
  let energy = 0;
  for (let index = 0; index < buffer.length; index++) {
    buffer.left[index] = highLeft.process(buffer.left[index]);
    buffer.right[index] = highRight.process(buffer.right[index]);
    energy += buffer.left[index] ** 2 + buffer.right[index] ** 2;
  }
  const rms = Math.sqrt(energy / (buffer.length * 2));
  const scale = rms > 0 ? targetRms / rms : 1;
  let maximum = 0;
  for (const channel of [buffer.left, buffer.right]) {
    for (let index = 0; index < channel.length; index++) {
      channel[index] = Math.tanh(channel[index] * scale);
      maximum = Math.max(maximum, Math.abs(channel[index]));
    }
  }
  if (maximum > peak) {
    for (const channel of [buffer.left, buffer.right]) {
      for (let index = 0; index < channel.length; index++) channel[index] *= peak / maximum;
    }
  }
}

export function normalizePeak(buffer, peak = 0.9) {
  let maximum = 0;
  for (const channel of [buffer.left, buffer.right]) {
    for (const sample of channel) maximum = Math.max(maximum, Math.abs(sample));
  }
  if (maximum === 0) return;
  for (const channel of [buffer.left, buffer.right]) {
    for (let index = 0; index < channel.length; index++) channel[index] *= peak / maximum;
  }
}

export function encodeWav(buffer, channels = 2) {
  const frames = buffer.length;
  const dataBytes = frames * channels * 2;
  const output = Buffer.alloc(44 + dataBytes);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataBytes, 4);
  output.write("WAVEfmt ", 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(channels, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * channels * 2, 28);
  output.writeUInt16LE(channels * 2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  for (let index = 0; index < frames; index++) {
    const samples = channels === 2 ? [buffer.left[index], buffer.right[index]] : [(buffer.left[index] + buffer.right[index]) * 0.5];
    for (const sample of samples) {
      output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), offset);
      offset += 2;
    }
  }
  return output;
}
