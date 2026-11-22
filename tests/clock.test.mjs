import { test } from "node:test";
import assert from "node:assert/strict";
import { createClock, stepsFor, MAX_FRAME_SECONDS, STEP_SECONDS } from "../logic/clock.mjs";

function stepsOverOneSecond(framesPerSecond) {
  const clock = createClock();
  let steps = 0;
  for (let frame = 0; frame < framesPerSecond; frame++) steps += stepsFor(clock, 1 / framesPerSecond);
  return steps;
}

test("one second of frames runs the same number of steps at any frame rate", () => {
  const rates = [30, 60, 120, 144, 165];

  const steps = rates.map(stepsOverOneSecond);

  assert.deepEqual(steps, rates.map(() => Math.round(1 / STEP_SECONDS)));
});

test("a frame shorter than a step carries its time into the next frame", () => {
  const clock = createClock();

  const first = stepsFor(clock, STEP_SECONDS * 0.6);
  const second = stepsFor(clock, STEP_SECONDS * 0.6);

  assert.deepEqual([first, second], [0, 1]);
});

test("a long stall runs at most a quarter of a second of steps", () => {
  const clock = createClock();

  const steps = stepsFor(clock, 5);

  assert.equal(steps, Math.round(MAX_FRAME_SECONDS / STEP_SECONDS));
});

test("a negative frame time runs no steps", () => {
  const clock = createClock();

  const steps = stepsFor(clock, -1);

  assert.equal(steps, 0);
});
