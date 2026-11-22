import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, stepWorld } from "../logic/world.mjs";
import { parseLevel } from "../logic/level.mjs";
import { TEST_LEVEL } from "../logic/testLevel.mjs";
import { SCREEN_WIDTH, TILE } from "../logic/screen.mjs";

test("the hero stands on the start tile", () => {
  const world = createWorld(parseLevel(TEST_LEVEL));

  assert.deepEqual(world.hero, { x: 2.5 * TILE, y: 19 * TILE });
});

test("the camera stops at both ends of the level", () => {
  const world = createWorld(parseLevel(TEST_LEVEL));

  stepWorld(world, { direction: -1 }, 1);
  const left = world.cameraX;
  stepWorld(world, { direction: 1 }, 100);
  const right = world.cameraX;

  assert.deepEqual([left, right], [0, 78 * TILE - SCREEN_WIDTH]);
});
