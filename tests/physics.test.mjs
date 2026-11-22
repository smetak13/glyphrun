import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeEnvelope,
  createHero,
  stepHero,
  COYOTE_TIME,
  GRAVITY,
  HERO_HEIGHT,
  BIG_HERO_HEIGHT,
  HERO_WIDTH,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  RUN_SPEED,
} from "../logic/physics.mjs";
import { parseLevel } from "../logic/level.mjs";
import { TILE } from "../logic/screen.mjs";

const STEP = 1 / 120;
const IDLE = { direction: 0, jumpHeld: false, jumpPressed: false };
const RUN = { direction: 1, jumpHeld: false, jumpPressed: false };
const RUN_JUMP = { direction: 1, jumpHeld: true, jumpPressed: true };
const RUN_HOLD = { direction: 1, jumpHeld: true, jumpPressed: false };
const JUMP = { direction: 0, jumpHeld: true, jumpPressed: true };
const HOLD = { direction: 0, jumpHeld: true, jumpPressed: false };

function levelFrom(bottomRows) {
  const cols = bottomRows[0].length;
  const rows = [];
  for (let i = 0; i < 22 - bottomRows.length; i++) rows.push(".".repeat(cols));
  return parseLevel(rows.concat(bottomRows));
}

function stepsFor(seconds) {
  return Math.round(seconds / STEP);
}

function run(hero, level, input, steps) {
  for (let i = 0; i < steps; i++) stepHero(hero, i === 0 ? input : Object.assign({}, input, { jumpPressed: false }), level, STEP);
}

function runUntil(hero, level, input, done, maxSteps) {
  for (let i = 0; i < maxSteps && !done(hero); i++) stepHero(hero, i === 0 ? input : Object.assign({}, input, { jumpPressed: false }), level, STEP);
}

function standingHero(col, row) {
  return createHero((col + 0.5) * TILE, row * TILE);
}

function peakRise(input) {
  const level = levelFrom(["..........", "##########"]);
  const hero = standingHero(5, 21);
  let peak = 0;
  stepHero(hero, input, level, STEP);
  const hold = { direction: 0, jumpHeld: input.jumpHeld, jumpPressed: false };
  for (let i = 0; i < 200; i++) {
    peak = Math.max(peak, 21 * TILE - hero.y);
    stepHero(hero, hold, level, STEP);
  }
  return peak;
}

function jumpFromLedge(gapTiles, riseTiles) {
  const lip = 8;
  const far = 22 - 2 - riseTiles;
  const rows = [];
  for (let row = 0; row < 22; row++) {
    let line = "";
    for (let col = 0; col < lip + gapTiles + 8; col++) {
      const nearGround = col < lip && row >= 20;
      const farGround = col >= lip + gapTiles && row >= far;
      line += nearGround || farGround ? "#" : ".";
    }
    rows.push(line);
  }
  const level = parseLevel(rows);
  const hero = createHero(lip * TILE + HERO_WIDTH / 2 - 0.01, 20 * TILE);
  hero.vx = RUN_SPEED;
  stepHero(hero, RUN_JUMP, level, STEP);
  runUntil(hero, level, RUN_HOLD, h => h.grounded || h.y > 22 * TILE, 240);
  return hero.grounded && hero.y === far * TILE;
}

test("the envelope's jump height matches the jump velocity and gravity", () => {
  const envelope = computeEnvelope();

  const analytic = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
  assert.ok(Math.abs(envelope.maxJumpHeight - analytic) < JUMP_VELOCITY * STEP);
});

test("the envelope's gap shrinks as the landing gets higher", () => {
  const envelope = computeEnvelope();

  assert.equal(envelope.maxGap, envelope.maxGapByRise[0]);
  assert.equal(envelope.maxGapByRise.length, Math.floor(envelope.maxJumpHeight / TILE) + 1);
  for (let i = 1; i < envelope.maxGapByRise.length; i++) assert.ok(envelope.maxGapByRise[i] < envelope.maxGapByRise[i - 1]);
});

test("a gap as wide as the envelope allows is cleared at full speed and one tile wider is not", () => {
  const widest = Math.floor(computeEnvelope().maxGap / TILE);

  assert.deepEqual([jumpFromLedge(widest, 0), jumpFromLedge(widest + 1, 0)], [true, false]);
});

test("every rise the envelope allows is reached across its widest gap", () => {
  const envelope = computeEnvelope();

  const results = envelope.maxGapByRise.map((gap, rise) => jumpFromLedge(Math.floor(gap / TILE), rise));

  assert.deepEqual(results, envelope.maxGapByRise.map(() => true));
});

test("a ledge one tile higher than the envelope's jump height cannot be reached", () => {
  const tooHigh = Math.floor(computeEnvelope().maxJumpHeight / TILE) + 1;

  assert.equal(jumpFromLedge(1, tooHigh), false);
});

test("releasing jump early makes a lower jump than holding it", () => {
  const held = peakRise(JUMP);
  const tapped = peakRise({ direction: 0, jumpHeld: false, jumpPressed: true });

  assert.ok(tapped < held / 2);
});

test("a jump pressed just after walking off a ledge still jumps", () => {
  const level = levelFrom(["####......", "####......"]);
  const hero = standingHero(3, 20);
  runUntil(hero, level, RUN, h => !h.grounded, 200);
  run(hero, level, RUN, stepsFor(COYOTE_TIME) - 2);

  stepHero(hero, RUN_JUMP, level, STEP);

  assert.ok(hero.vy < 0);
});

test("a jump pressed after the coyote time does nothing", () => {
  const level = levelFrom(["####......", "####......"]);
  const hero = standingHero(3, 20);
  runUntil(hero, level, RUN, h => !h.grounded, 200);
  run(hero, level, RUN, stepsFor(COYOTE_TIME) + 2);

  stepHero(hero, RUN_JUMP, level, STEP);

  assert.ok(hero.vy > 0);
});

test("a jump pressed just before landing fires on landing", () => {
  const level = levelFrom(["..........", "##########"]);
  const hero = createHero(5 * TILE, 21 * TILE - 40);
  runUntil(hero, level, IDLE, h => h.y > 21 * TILE - 6, 200);

  stepHero(hero, JUMP, level, STEP);
  runUntil(hero, level, HOLD, h => h.grounded, stepsFor(JUMP_BUFFER_TIME));
  stepHero(hero, HOLD, level, STEP);

  assert.ok(hero.vy < 0);
});

test("a jump pressed long before landing is forgotten", () => {
  const level = levelFrom(["..........", "##########"]);
  const hero = createHero(5 * TILE, 21 * TILE - 150);

  stepHero(hero, JUMP, level, STEP);
  runUntil(hero, level, HOLD, h => h.grounded, 200);
  stepHero(hero, HOLD, level, STEP);

  assert.deepEqual([hero.y, hero.grounded], [21 * TILE, true]);
});

test("the hero stands still on a floor", () => {
  const level = levelFrom(["..........", "##########"]);
  const hero = standingHero(5, 21);

  run(hero, level, IDLE, 120);

  assert.deepEqual([hero.y, hero.vy, hero.grounded], [21 * TILE, 0, true]);
});

test("a wall stops the hero flush against it", () => {
  const level = levelFrom(["......#...", "##########"]);
  const hero = standingHero(2, 21);

  run(hero, level, RUN, 240);

  assert.deepEqual([hero.x, hero.vx], [6 * TILE - HERO_WIDTH / 2, 0]);
});

test("a ceiling stops a jump without letting the hero through", () => {
  const level = levelFrom(["#####", ".....", ".....", "#####"]);
  const hero = standingHero(2, 21);

  run(hero, level, JUMP, 30);

  assert.ok(hero.y - HERO_HEIGHT >= 19 * TILE);
  run(hero, level, IDLE, 120);
  assert.deepEqual([hero.y, hero.grounded], [21 * TILE, true]);
});

test("a big hero bumps its head a tile lower than a small one", () => {
  const level = levelFrom(["#####", ".....", ".....", ".....", "#####"]);
  const small = standingHero(2, 21);
  const big = standingHero(2, 21);
  big.big = true;

  const peak = hero => {
    let top = hero.y;
    for (let i = 0; i < 60; i++) {
      run(hero, level, JUMP, 1);
      top = Math.min(top, hero.y);
    }
    return top;
  };

  assert.deepEqual([peak(small), peak(big)], [18 * TILE + HERO_HEIGHT, 18 * TILE + BIG_HERO_HEIGHT]);
});

test("the hero jumps up through a platform and lands on top of it", () => {
  const level = levelFrom(["..=====...", "..........", "..........", "##########"]);
  const hero = standingHero(4, 21);

  run(hero, level, JUMP, 120);

  assert.deepEqual([hero.y, hero.grounded], [18 * TILE, true]);
});

test("the hero stands on a ledge while only its edge overlaps the ground", () => {
  const level = levelFrom(["###.......", "###......."]);
  const hero = createHero(3 * TILE + HERO_WIDTH / 2 - 1, 20 * TILE);

  run(hero, level, IDLE, 60);

  assert.deepEqual([hero.y, hero.grounded], [20 * TILE, true]);
});

test("the hero falls once its edge is past the ledge", () => {
  const level = levelFrom(["###.......", "###......."]);
  const hero = createHero(3 * TILE + HERO_WIDTH / 2 + 0.5, 20 * TILE);

  run(hero, level, IDLE, 60);

  assert.ok(hero.y > 20 * TILE);
});
