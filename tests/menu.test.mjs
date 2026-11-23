import { test } from "node:test";
import assert from "node:assert/strict";
import { canContinue, mainMenuItems, moveIndex, percent, stepVolume } from "../logic/menu.mjs";

const IN_PROGRESS = { over: false, won: false };

test("Continue is offered only while a run is in progress", () => {
  assert.equal(canContinue(IN_PROGRESS), true);
  assert.equal(canContinue(null), false);
  assert.equal(canContinue({ over: true, won: false }), false);
  assert.equal(canContinue({ over: false, won: true }), false);
});

test("the main menu starts with Continue when a run can be continued", () => {
  assert.deepEqual(mainMenuItems(IN_PROGRESS), ["Continue", "New run", "Enter seed", "High scores", "Settings"]);
  assert.deepEqual(mainMenuItems(null), ["New run", "Enter seed", "High scores", "Settings"]);
});

test("menu selection wraps around at both ends", () => {
  assert.equal(moveIndex(0, -1, 4), 3);
  assert.equal(moveIndex(3, 1, 4), 0);
});

test("volume moves in tenths and stays between silent and full", () => {
  assert.equal(stepVolume(0.3, 1), 0.4);
  assert.equal(stepVolume(0.7, -1), 0.6);
  assert.equal(stepVolume(1, 1), 1);
  assert.equal(stepVolume(0, -1), 0);
});

test("volume shows as a whole percentage", () => {
  assert.equal(percent(stepVolume(0.2, 1)), "30%");
});
