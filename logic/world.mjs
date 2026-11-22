import { TILE, SCREEN_WIDTH, SCREEN_HEIGHT } from "./screen.mjs";
import { createHero, stepHero, HERO_WIDTH, HERO_HEIGHT } from "./physics.mjs";

export const CAMERA_LEAD = 320;
export const CAMERA_FOLLOW_RATE = 6;
const BIT_REACH = 8;

export function createWorld(level) {
  const world = {
    level,
    cameraX: 0,
    hero: null,
    bits: level.bits.map(bit => ({ col: bit.col, row: bit.row, text: bit.text, collected: false })),
    bitsCollected: 0,
    checkpointReached: false,
    finished: false,
    time: 0,
  };
  placeHero(world, level.start);
  return world;
}

function placeHero(world, tile) {
  world.hero = createHero((tile.col + 0.5) * TILE, (tile.row + 1) * TILE);
  world.cameraX = cameraTarget(world);
}

function cameraTarget(world) {
  const maxCameraX = Math.max(world.level.cols * TILE - SCREEN_WIDTH, 0);
  return Math.min(Math.max(world.hero.x - CAMERA_LEAD, 0), maxCameraX);
}

function keepInsideLevel(hero, level) {
  const half = HERO_WIDTH / 2;
  const right = level.cols * TILE - half;
  if (hero.x < half || hero.x > right) {
    hero.x = Math.min(Math.max(hero.x, half), right);
    hero.vx = 0;
  }
}

function collectBits(world) {
  const hero = world.hero;
  for (const bit of world.bits) {
    if (bit.collected) continue;
    const touchesX = Math.abs((bit.col + 0.5) * TILE - hero.x) < HERO_WIDTH / 2 + BIT_REACH;
    const centerY = (bit.row + 0.5) * TILE;
    const touchesY = centerY > hero.y - HERO_HEIGHT - BIT_REACH && centerY < hero.y + BIT_REACH;
    if (touchesX && touchesY) {
      bit.collected = true;
      world.bitsCollected++;
    }
  }
}

function reached(world, tile) {
  return tile !== null && world.hero.x >= tile.col * TILE;
}

export function stepWorld(world, input, seconds) {
  if (world.finished) return;
  world.time += seconds;
  const hero = world.hero;
  stepHero(hero, input, world.level, seconds);
  keepInsideLevel(hero, world.level);
  collectBits(world);
  if (!world.checkpointReached && reached(world, world.level.checkpoint)) world.checkpointReached = true;
  if (reached(world, world.level.exit)) world.finished = true;
  if (hero.y - HERO_HEIGHT > SCREEN_HEIGHT) {
    placeHero(world, world.checkpointReached ? world.level.checkpoint : world.level.start);
    return;
  }
  world.cameraX += (cameraTarget(world) - world.cameraX) * Math.min(1, seconds * CAMERA_FOLLOW_RATE);
}
