function mix(value) {
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

function hashLabel(label) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) hash = Math.imul(hash ^ label.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), state | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    },
  };
}

export function subStream(seed, label) {
  return createRandom(mix((seed >>> 0) ^ mix(hashLabel(label))));
}

export function randomInt(random, min, max) {
  return min + Math.floor(random.next() * (max - min + 1));
}

export function pick(random, items) {
  return items[Math.floor(random.next() * items.length)];
}

export function shuffle(random, items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    const item = copy[i];
    copy[i] = copy[j];
    copy[j] = item;
  }
  return copy;
}
