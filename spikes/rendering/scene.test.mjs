import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLevel, createScene, stepScene, W, MOVER_COUNT } from "./scene.mjs";

test("the level is the same for the same seed", () => {
  assert.deepEqual(buildLevel(7), buildLevel(7));
});

test("all movers stay on screen while the camera scrolls", () => {
  const scene = createScene(7);

  for (let i = 0; i < 600; i++) stepScene(scene, 1 / 60);

  const onScreen = scene.movers.filter(m => m.x > scene.camX - 48 && m.x < scene.camX + W + 48);
  assert.equal(onScreen.length, MOVER_COUNT);
});
