import { test } from "node:test";
import assert from "node:assert/strict";
import { createClock, createFrameTimer, measureFrame, smoothFrame, stepsFor, MAX_FRAME_SECONDS, STEP_SECONDS } from "../logic/clock.mjs";

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

test("the first measured frame of a window takes no time", () => {
  const timer = createFrameTimer();

  const seconds = measureFrame(timer, 5000);

  assert.equal(seconds, 0);
});

test("a measured frame is the time since the previous one, at most a quarter of a second", () => {
  const timer = createFrameTimer();
  measureFrame(timer, 1000);

  const frames = [measureFrame(timer, 1017), measureFrame(timer, 3000)];

  assert.deepEqual(frames, [0.017, MAX_FRAME_SECONDS]);
});

test("millisecond jitter at 60 fps runs exactly two steps every frame", () => {
  const lateness = [0, 1.4, 0.3, 1.1, 0.7, 1.9, 0.2];
  const timestamps = Array.from({ length: 40 }, (_, i) => Math.floor(i * 1000 / 60 + lateness[i % lateness.length]));
  const offsets = Array.from({ length: 100 }, (_, i) => STEP_SECONDS * i / 100);

  const steps = offsets.flatMap(offset => {
    const timer = createFrameTimer();
    const clock = createClock();
    stepsFor(clock, offset);
    return timestamps.map(ms => stepsFor(clock, smoothFrame(timer, measureFrame(timer, ms)))).slice(10);
  });

  assert.deepEqual(steps, steps.map(() => 2));
});

test("smoothing keeps frames of a rate that is not a multiple of the step", () => {
  const timer = createFrameTimer();

  const frames = Array.from({ length: 10 }, () => smoothFrame(timer, 1 / 144));

  assert.ok(Math.abs(frames[9] - 1 / 144) < 1e-9);
});

test("a stall is spread over the following frames without losing time", () => {
  const timer = createFrameTimer();
  const millis = [13, 13, 13, 13, 13, 13, 13, 13, 100, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13];

  const smoothed = millis.map(ms => smoothFrame(timer, ms / 1000));

  assert.ok(smoothed[8] < 0.1);
  assert.ok(Math.abs(smoothed.reduce((a, b) => a + b) - millis.reduce((a, b) => a + b) / 1000) < 1e-9);
});

test("a frame that takes no time is not smoothed", () => {
  const timer = createFrameTimer();
  smoothFrame(timer, 0.016);

  const seconds = smoothFrame(timer, 0);

  assert.equal(seconds, 0);
});
