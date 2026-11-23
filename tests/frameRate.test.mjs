import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrameWatcher, resetFrameWatcher, watchFrame, HITCH_SECONDS, SLOW_WINDOWS, WINDOW_SECONDS } from "../logic/frameRate.mjs";

function watchFor(watcher, fps, seconds) {
  let switched = false;
  for (let i = 0; i < Math.round(seconds * fps); i++) switched = watchFrame(watcher, 1 / fps) || switched;
  return switched;
}

const SLOW_SECONDS = WINDOW_SECONDS * SLOW_WINDOWS + 0.1;

test("a steady 60 fps never switches to reduced effects", () => {
  const watcher = createFrameWatcher();

  assert.equal(watchFor(watcher, 60, 60), false);
});

test("staying under 50 fps switches to reduced effects", () => {
  const watcher = createFrameWatcher();

  assert.equal(watchFor(watcher, 40, SLOW_SECONDS), true);
});

test("one slow window alone does not switch", () => {
  const watcher = createFrameWatcher();

  watchFor(watcher, 40, WINDOW_SECONDS + 0.1);
  const switched = watchFor(watcher, 60, WINDOW_SECONDS) || watchFor(watcher, 40, WINDOW_SECONDS - 0.2);

  assert.equal(switched, false);
});

test("a single long hitch such as loading a level is ignored", () => {
  const watcher = createFrameWatcher();

  watchFor(watcher, 60, 1);
  watchFrame(watcher, HITCH_SECONDS + 0.1);

  assert.equal(watchFor(watcher, 60, SLOW_SECONDS), false);
});

test("resetting the watcher forgets the slow frames so far", () => {
  const watcher = createFrameWatcher();
  watchFor(watcher, 40, SLOW_SECONDS - 0.5);

  resetFrameWatcher(watcher);

  assert.equal(watchFor(watcher, 40, WINDOW_SECONDS + 0.1), false);
});
