import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, respawnHero, stepWorld, CAMERA_LEAD } from "../logic/world.mjs";
import { createClock, stepsFor, STEP_SECONDS } from "../logic/clock.mjs";
import { parseLevel } from "../logic/level.mjs";
import { TEST_LEVEL } from "../logic/testLevel.mjs";
import { SCREEN_WIDTH, TILE } from "../logic/screen.mjs";
import { arenaLevel } from "../logic/boss.mjs";

const IDLE = { direction: 0, jumpHeld: false, jumpPressed: false };
const RIGHT = { direction: 1, jumpHeld: false, jumpPressed: false };

function levelFrom(bottomRows) {
  const cols = bottomRows[0].length;
  const rows = [];
  for (let i = 0; i < 22 - bottomRows.length; i++) rows.push(".".repeat(cols));
  return parseLevel(rows.concat(bottomRows));
}

function steps(world, input, count) {
  for (let i = 0; i < count; i++) stepWorld(world, input, STEP_SECONDS);
}

function stepUntil(world, input, done) {
  for (let i = 0; i < 10000 && !done(world); i++) stepWorld(world, input, STEP_SECONDS);
}

function playAtFrameRate(framesPerSecond, timeline, seconds) {
  const world = createWorld(parseLevel(TEST_LEVEL));
  const clock = createClock();
  let jumpPressed = false;
  let held = IDLE;
  for (let frame = 0; frame < seconds * framesPerSecond; frame++) {
    const now = frame / framesPerSecond;
    for (const change of timeline) {
      if (Math.abs(change.at - now) < 1e-9) {
        if (change.input.jumpHeld && !held.jumpHeld) jumpPressed = true;
        held = change.input;
      }
    }
    const count = stepsFor(clock, 1 / framesPerSecond);
    for (let i = 0; i < count; i++) {
      stepWorld(world, { direction: held.direction, jumpHeld: held.jumpHeld, jumpPressed }, STEP_SECONDS);
      jumpPressed = false;
    }
  }
  return world;
}

test("the hero starts standing on the start tile", () => {
  const world = createWorld(parseLevel(TEST_LEVEL));

  assert.deepEqual([world.hero.x, world.hero.y, world.hero.grounded], [2.5 * TILE, 19 * TILE, true]);
});

test("the same input plays out identically at different frame rates", () => {
  const timeline = [
    { at: 0, input: RIGHT },
    { at: 1, input: { direction: 1, jumpHeld: true, jumpPressed: false } },
    { at: 1.25, input: RIGHT },
    { at: 2, input: { direction: -1, jumpHeld: true, jumpPressed: false } },
    { at: 2.5, input: IDLE },
  ];

  const worlds = [60, 120, 144].map(rate => playAtFrameRate(rate, timeline, 3));

  assert.deepEqual(worlds[1], worlds[0]);
  assert.deepEqual(worlds[2], worlds[0]);
});

test("the camera follows the hero and stops at both ends of the level", () => {
  const world = createWorld(levelFrom([".@" + ".".repeat(98), "#".repeat(100)]));
  const atStart = world.cameraX;

  steps(world, RIGHT, 240);
  const following = world.hero.x - world.cameraX;
  stepUntil(world, RIGHT, w => w.hero.vx === 0 && w.cameraX > 100 * TILE - SCREEN_WIDTH - 1);

  assert.equal(atStart, 0);
  assert.ok(Math.abs(following - CAMERA_LEAD) < 2 * TILE);
  assert.ok(Math.abs(world.cameraX - (100 * TILE - SCREEN_WIDTH)) < 1);
});

test("the hero cannot leave the level at either end", () => {
  const world = createWorld(levelFrom(["@...", "####"]));

  steps(world, { direction: -1, jumpHeld: false, jumpPressed: false }, 120);
  const left = world.hero.x;
  steps(world, RIGHT, 240);

  assert.ok(left > 0 && world.hero.x < 4 * TILE);
});

function stepUntilEvent(world, input, type) {
  for (let i = 0; i < 10000; i++) {
    const events = stepWorld(world, input, STEP_SECONDS);
    if (events.some(e => e.type === type)) return events;
  }
  return [];
}

test("falling into a pit is reported once the hero has left the screen", () => {
  const world = createWorld(levelFrom([".@......C...", "####..######"]));

  const events = stepUntilEvent(world, RIGHT, "pit");

  assert.deepEqual(events.map(e => e.type), ["pit"]);
  assert.ok(world.hero.y > 22 * TILE);
});

test("respawning puts the hero back at the start, small", () => {
  const world = createWorld(levelFrom([".@......C...", "####..######"]));
  world.hero.big = true;
  stepUntilEvent(world, RIGHT, "pit");

  respawnHero(world);

  assert.deepEqual([world.hero.x, world.hero.y, world.hero.big], [1.5 * TILE, 21 * TILE, false]);
});

test("after the checkpoint, respawning puts the hero back at the checkpoint", () => {
  const world = createWorld(levelFrom([".@C.........", "#####..#####"]));
  const events = stepUntilEvent(world, RIGHT, "checkpoint");
  stepUntilEvent(world, RIGHT, "pit");

  respawnHero(world);

  assert.deepEqual(events.map(e => e.type), ["checkpoint"]);
  assert.equal(world.checkpointReached, true);
  assert.deepEqual([world.hero.x, world.hero.y], [2.5 * TILE, 21 * TILE]);
});

test("reaching the exit finishes the level and stops the world", () => {
  const world = createWorld(levelFrom([".@....X...", "##########"]));

  stepUntil(world, RIGHT, w => w.finished);
  const x = world.hero.x;
  steps(world, RIGHT, 60);

  assert.equal(world.finished, true);
  assert.equal(world.hero.x, x);
});

test("running through a bit collects it once", () => {
  const world = createWorld(levelFrom([".@..1.0...", "##########"]));

  stepUntil(world, RIGHT, w => w.hero.x > 5 * TILE);

  assert.deepEqual(world.bits.map(b => b.collected), [true, false]);
  assert.equal(world.bitsCollected, 1);
});

test("collecting a bit reports it", () => {
  const world = createWorld(levelFrom([".@..1.....", "##########"]));

  const events = stepUntilEvent(world, RIGHT, "bit");

  assert.equal(events[0].bit, world.bits[0]);
});

test("the sudo bit is reported but not counted among the bits", () => {
  const world = createWorld(levelFrom([".@..S.....", "##########"]));

  const events = stepUntilEvent(world, RIGHT, "bit");

  assert.equal(events[0].bit.sudo, true);
  assert.equal(world.bitsCollected, 0);
});

test("a big hero collects bits at its head height that a small one passes under", () => {
  const rows = [".....1....", ".@........", "##########"];
  const small = createWorld(levelFrom(rows));
  const big = createWorld(levelFrom(rows));
  big.hero.big = true;

  stepUntil(small, RIGHT, w => w.hero.x > 6 * TILE);
  stepUntil(big, RIGHT, w => w.hero.x > 6 * TILE);

  assert.deepEqual([small.bitsCollected, big.bitsCollected], [0, 1]);
});

test("a bit out of reach stays", () => {
  const world = createWorld(levelFrom(["...1......", "..........", "..........", ".@........", "##########"]));

  stepUntil(world, RIGHT, w => w.hero.x > 6 * TILE);

  assert.equal(world.bitsCollected, 0);
});

test("the boss arena starts its fight with the world", () => {
  const world = createWorld(arenaLevel(1));

  assert.deepEqual([world.boss.state, world.cameraX], ["intro", 0]);
});

test("respawning in the arena puts the hero back at its start against a fresh boss", () => {
  const world = createWorld(arenaLevel(1));
  const start = world.hero.x;
  stepUntil(world, RIGHT, w => w.boss.state === "attack");
  const fought = world.boss;

  respawnHero(world);

  assert.notEqual(world.boss, fought);
  assert.deepEqual([world.boss.state, world.boss.hits, world.hero.x], ["intro", 0, start]);
});
