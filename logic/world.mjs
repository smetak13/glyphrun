import { TILE, SCREEN_WIDTH } from "./screen.mjs";

export const CAMERA_PAN_SPEED = 480;

export function createWorld(level) {
  return {
    level,
    cameraX: 0,
    hero: { x: (level.start.col + 0.5) * TILE, y: (level.start.row + 1) * TILE },
  };
}

export function stepWorld(world, input, seconds) {
  const maxCameraX = Math.max(world.level.cols * TILE - SCREEN_WIDTH, 0);
  world.cameraX = Math.min(Math.max(world.cameraX + input.direction * CAMERA_PAN_SPEED * seconds, 0), maxCameraX);
}
