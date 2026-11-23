import { createRandom, randomInt } from "./random.mjs";
import { SCREEN_WIDTH } from "./screen.mjs";

export const BACKDROP_WIDTH = 2 * SCREEN_WIDTH;
export const FAR_PARALLAX = 0.3;
export const NEAR_PARALLAX = 0.6;
const BACKDROP_SEED = 7;
const FAR_COLUMN_STEP = 130;
const FAR_ROW_STEP = 15;
const FAR_TOP = 48;
const FAR_BOTTOM = 450;
const NEAR_COUNT = 72;
const NEAR_TOP = 60;
const NEAR_HEIGHT = 330;
const NEAR_TEXT_WIDTH = 60;

function hex(value, digits) {
  return value.toString(16).padStart(digits, "0");
}

export function backdropLayers() {
  const random = createRandom(BACKDROP_SEED);
  const far = [];
  for (let x = 0; x < BACKDROP_WIDTH; x += FAR_COLUMN_STEP) {
    for (let y = FAR_TOP; y < FAR_BOTTOM; y += FAR_ROW_STEP) {
      if (random.next() >= 0.5) continue;
      const bytes = [0, 0, 0, 0].map(() => hex(randomInt(random, 0, 255), 2));
      far.push({ x, y, text: bytes.join(" ") });
    }
  }
  const near = [];
  for (let i = 0; i < NEAR_COUNT; i++) {
    const x = Math.floor(random.next() * (BACKDROP_WIDTH - NEAR_TEXT_WIDTH));
    const y = Math.floor(NEAR_TOP + random.next() * NEAR_HEIGHT);
    near.push({ x, y, text: "0x" + hex(randomInt(random, 0, 0xffff), 4) });
  }
  return { far, near };
}

export function backdropOffset(cameraX, parallax) {
  return -((cameraX * parallax) % BACKDROP_WIDTH);
}
