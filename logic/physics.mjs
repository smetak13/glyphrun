import { TILE } from "./screen.mjs";
import { tileAt } from "./level.mjs";

export const RUN_SPEED = 216;
export const ACCELERATION = 1800;
export const AIR_ACCELERATION = 1200;
export const GRAVITY = 1500;
export const FALL_GRAVITY = 2100;
export const MAX_FALL_SPEED = 720;
export const JUMP_VELOCITY = 560;
export const JUMP_CUT_VELOCITY = 200;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER_TIME = 0.12;
export const HERO_WIDTH = 16;
export const HERO_HEIGHT = 22;
export const BIG_HERO_HEIGHT = 44;

const HALF_WIDTH = HERO_WIDTH / 2;
const EDGE = 1e-6;
const ENVELOPE_STEP = 1 / 120;

export function createHero(x, y) {
  return { x, y, vx: 0, vy: 0, big: false, grounded: true, jumping: false, coyote: 0, buffer: 0 };
}

export function isSolid(tile) {
  return tile === "#" || tile === "B" || tile === "H";
}

export function heroHeight(hero) {
  return hero.big ? BIG_HERO_HEIGHT : HERO_HEIGHT;
}

function approach(value, target, delta) {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

function rowsOf(hero) {
  return [Math.floor((hero.y - heroHeight(hero)) / TILE), Math.floor((hero.y - EDGE) / TILE)];
}

function colsOf(hero) {
  return [Math.floor((hero.x - HALF_WIDTH) / TILE), Math.floor((hero.x + HALF_WIDTH - EDGE) / TILE)];
}

function columnBlocked(level, col, rows) {
  for (let row = rows[0]; row <= rows[1]; row++) if (isSolid(tileAt(level, col, row))) return true;
  return false;
}

function rowHas(level, row, cols, matches) {
  for (let col = cols[0]; col <= cols[1]; col++) if (matches(tileAt(level, col, row))) return true;
  return false;
}

function moveX(hero, dx, level) {
  hero.x += dx;
  const rows = rowsOf(hero);
  if (dx > 0) {
    const col = Math.floor((hero.x + HALF_WIDTH - EDGE) / TILE);
    if (columnBlocked(level, col, rows)) {
      hero.x = col * TILE - HALF_WIDTH;
      hero.vx = 0;
    }
  } else if (dx < 0) {
    const col = Math.floor((hero.x - HALF_WIDTH) / TILE);
    if (columnBlocked(level, col, rows)) {
      hero.x = (col + 1) * TILE + HALF_WIDTH;
      hero.vx = 0;
    }
  }
}

function moveY(hero, dy, level) {
  const oldBottom = hero.y;
  hero.y += dy;
  hero.grounded = false;
  const cols = colsOf(hero);
  if (dy > 0) {
    const row = Math.floor((hero.y - EDGE) / TILE);
    const top = row * TILE;
    const wasAbove = oldBottom <= top + EDGE;
    if (rowHas(level, row, cols, tile => isSolid(tile) || (tile === "=" && wasAbove))) {
      hero.y = top;
      hero.vy = 0;
      hero.grounded = true;
    }
  } else if (dy < 0) {
    const row = Math.floor((hero.y - heroHeight(hero)) / TILE);
    if (rowHas(level, row, cols, isSolid)) {
      hero.y = (row + 1) * TILE + heroHeight(hero);
      hero.vy = 0;
    }
  }
}

export function stepHero(hero, input, level, seconds) {
  const acceleration = hero.grounded ? ACCELERATION : AIR_ACCELERATION;
  hero.vx = approach(hero.vx, input.direction * RUN_SPEED, acceleration * seconds);

  hero.coyote = hero.grounded ? COYOTE_TIME : Math.max(hero.coyote - seconds, 0);
  hero.buffer = input.jumpPressed ? JUMP_BUFFER_TIME : Math.max(hero.buffer - seconds, 0);
  if (hero.buffer > 0 && hero.coyote > 0) {
    hero.vy = -JUMP_VELOCITY;
    hero.jumping = true;
    hero.buffer = 0;
    hero.coyote = 0;
  }
  if (hero.jumping && !input.jumpHeld && hero.vy < -JUMP_CUT_VELOCITY) hero.vy = -JUMP_CUT_VELOCITY;
  if (hero.vy >= 0) hero.jumping = false;

  const gravity = hero.vy < 0 ? GRAVITY : FALL_GRAVITY;
  hero.vy = Math.min(hero.vy + gravity * seconds, MAX_FALL_SPEED);

  moveX(hero, hero.vx * seconds, level);
  moveY(hero, hero.vy * seconds, level);
}

export function computeEnvelope() {
  const emptyLevel = { cols: 0, rows: [] };
  const hero = createHero(0, 0);
  hero.vx = RUN_SPEED;
  const path = [];
  let input = { direction: 1, jumpHeld: true, jumpPressed: true };
  do {
    stepHero(hero, input, emptyLevel, ENVELOPE_STEP);
    input = { direction: 1, jumpHeld: true, jumpPressed: false };
    path.push({ dx: hero.x, rise: -hero.y });
  } while (hero.y < 0);

  const maxJumpHeight = Math.max.apply(null, path.map(p => p.rise));
  const maxGapByRise = [];
  for (let rise = 0; rise * TILE <= maxJumpHeight; rise++) {
    let gap = 0;
    for (const point of path) if (point.rise >= rise * TILE) gap = point.dx + HERO_WIDTH;
    maxGapByRise.push(gap);
  }
  return { maxJumpHeight, maxGap: maxGapByRise[0], maxGapByRise };
}
