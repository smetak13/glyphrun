import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEATH_FREEZE_SECONDS,
  DEATH_SCATTER_SECONDS,
  FIDGET_AFTER_SECONDS,
  PART_COUNT,
  SIZE_CHANGE_SECONDS,
  createHeroAnimator,
  deathParts,
  heroParts,
  heroPose,
  heroState,
  shownBig,
  stepHeroAnimator,
} from "../logic/heroFigure.mjs";
import { SPRINT_SPEED, WALK_SPEED, createHero } from "../logic/physics.mjs";
import { parseLevel } from "../logic/level.mjs";
import { TILE } from "../logic/screen.mjs";

const FRAME = 1 / 60;

function levelFrom(bottomRows) {
  const cols = bottomRows[0].length;
  const rows = [];
  for (let i = 0; i < 22 - bottomRows.length; i++) rows.push(".".repeat(cols));
  return parseLevel(rows.concat(bottomRows));
}

const FLAT = levelFrom(["..........", "##########"]);
const TUNNEL = levelFrom(["..BBBB....", "..........", "##########"]);

function standing(col) {
  return createHero((col + 0.5) * TILE, 21 * TILE);
}

function settled(hero) {
  const animator = createHeroAnimator(hero);
  stepHeroAnimator(animator, hero, 0, 1);
  return animator;
}

function stateOf(hero, level, direction) {
  return heroState(settled(hero), hero, level || FLAT, direction || 0);
}

test("an airborne hero jumps, peaks and falls by its vertical speed", () => {
  const hero = standing(3);
  hero.grounded = false;

  assert.equal(stateOf(Object.assign(hero, { vy: -400 })), "jump");
  assert.equal(stateOf(Object.assign(hero, { vy: 0 })), "peak");
  assert.equal(stateOf(Object.assign(hero, { vy: 400 })), "fall");
});

test("a hero squashes for a moment after touching down", () => {
  const hero = standing(3);
  hero.grounded = false;
  const animator = createHeroAnimator(hero);
  hero.grounded = true;

  stepHeroAnimator(animator, hero, 0, FRAME);

  assert.equal(heroState(animator, hero, FLAT, 0), "land");
  stepHeroAnimator(animator, hero, 0, 0.2);
  assert.equal(heroState(animator, hero, FLAT, 0), "idle");
});

test("a grounded hero walks at walking speed and runs above it", () => {
  assert.equal(stateOf(Object.assign(standing(3), { vx: WALK_SPEED }), FLAT, 1), "walk");
  assert.equal(stateOf(Object.assign(standing(3), { vx: SPRINT_SPEED }), FLAT, 1), "run");
});

test("reversing at speed skids", () => {
  assert.equal(stateOf(Object.assign(standing(3), { vx: WALK_SPEED }), FLAT, -1), "skid");
});

test("standing still long enough starts the coding break, and moving ends it", () => {
  const hero = standing(3);
  const animator = createHeroAnimator(hero);

  stepHeroAnimator(animator, hero, 0, FIDGET_AFTER_SECONDS + 0.1);
  const resting = heroState(animator, hero, FLAT, 0);
  stepHeroAnimator(animator, hero, 1, FRAME);

  assert.equal(resting, "fidget");
  assert.equal(heroState(animator, hero, FLAT, 1), "idle");
});

test("the small hero ducks under a ceiling right above it, the big one does not", () => {
  assert.equal(stateOf(standing(3), TUNNEL), "duck");
  assert.equal(stateOf(standing(7), TUNNEL), "idle");
  assert.equal(stateOf(Object.assign(standing(3), { big: true }), TUNNEL), "idle");
});

test("growing flickers between small and big before settling big", () => {
  const hero = standing(3);
  const animator = createHeroAnimator(hero);
  hero.big = true;

  const shown = [];
  for (let t = 0; t < SIZE_CHANGE_SECONDS; t += 0.05) {
    stepHeroAnimator(animator, hero, 0, 0.05);
    shown.push(shownBig(animator, hero));
  }
  stepHeroAnimator(animator, hero, 0, 0.1);

  assert.ok(shown.includes(true) && shown.includes(false));
  assert.equal(shownBig(animator, hero), true);
});

test("animating the hero never changes the hero itself", () => {
  const hero = Object.assign(standing(3), { vx: 100 });
  const before = JSON.stringify(hero);
  const animator = createHeroAnimator(hero);

  for (let i = 0; i < 300; i++) stepHeroAnimator(animator, hero, i % 3 - 1, FRAME);
  heroParts(heroPose(heroState(animator, hero, FLAT, 1), animator.time), true, 1, animator.time, 100);

  assert.equal(JSON.stringify(hero), before);
});

test("the run holds its stride poses longer than the passing poses between them", () => {
  const strides = [0, 0.06, 0.12].map(t => heroPose("run", t).legs[0]);
  const passing = heroPose("run", 0.15).legs[0];

  assert.deepEqual(strides, [strides[0], strides[0], strides[0]]);
  assert.ok(Math.abs(passing) < Math.abs(strides[0]));
});

test("a running stride is wider than a walking one", () => {
  assert.ok(Math.abs(heroPose("run", 0).legs[0]) > Math.abs(heroPose("walk", 0).legs[0]));
});

test("the figure always has the same parts and stands on its feet", () => {
  const parts = heroParts(heroPose("idle", 0), false, 1, 0, 0);
  const lowest = Math.max.apply(null, parts.filter(p => p.text === "┃").map(p => p.y + p.height / 2));

  assert.equal(parts.length, PART_COUNT);
  assert.ok(Math.abs(lowest) < 1.5);
});

test("the big hero is taller and wears the root badge", () => {
  const top = parts => Math.min.apply(null, parts.filter(p => p.text !== "").map(p => p.y - p.height / 2));
  const small = heroParts(heroPose("idle", 0), false, 1, 0, 0);
  const big = heroParts(heroPose("idle", 0), true, 1, 0, 0);

  assert.ok(top(big) < top(small) - 15);
  assert.ok(big.some(p => p.text === "#"));
  assert.ok(!small.some(p => p.text === "#"));
});

test("facing left mirrors the figure", () => {
  const right = heroParts(heroPose("walk", 0), false, 1, 0, WALK_SPEED);
  const left = heroParts(heroPose("walk", 0), false, -1, 0, WALK_SPEED);

  assert.deepEqual(left.map(p => p.x), right.map(p => -p.x));
});

test("the scarf grows with speed", () => {
  const scarf = speed => heroParts(heroPose("walk", 0), false, 1, 0, speed)[0].text.length;

  assert.ok(scarf(SPRINT_SPEED) > scarf(0));
});

test("the coding break shows a laptop", () => {
  const parts = heroParts(heroPose("fidget", 0), false, 1, 0, 0);

  assert.ok(parts.some(p => p.text === "┛"));
});

test("a dying hero freezes, then scatters and fades out", () => {
  const parts = heroParts(heroPose("dead", 0), false, 1, 0, 0);

  const frozen = deathParts(parts, DEATH_FREEZE_SECONDS / 2);
  const gone = deathParts(parts, DEATH_FREEZE_SECONDS + DEATH_SCATTER_SECONDS + 0.01);

  assert.deepEqual(frozen, parts);
  assert.ok(gone.every(p => p.opacity === 0));
});
