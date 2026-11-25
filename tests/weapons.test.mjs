import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, stepWorld, armWorld } from "../logic/world.mjs";
import { createRun, stepRun, hitHero, nextLevel, armHero } from "../logic/run.mjs";
import { parseLevel } from "../logic/level.mjs";
import { STEP_SECONDS } from "../logic/clock.mjs";
import { TILE } from "../logic/screen.mjs";
import { generateLevel } from "../logic/generator.mjs";
import { arenaLevel } from "../logic/boss.mjs";
import { createEnemy } from "../logic/enemies.mjs";
import { KILL_POINTS, LEAK_POINTS } from "../logic/score.mjs";
import {
  WEAPON_IDS,
  WEAPONS,
  HINT_SECONDS,
  HINT_AFTER_FIRE_SECONDS,
  DUCK_COOLDOWN,
  DUCK_LIMIT,
  BREAKPOINT_COOLDOWN,
  PAUSE_SECONDS,
  CLAUDE_NOTHING,
  CLAUDE_LINES,
  weaponFor,
  weaponGlyphs,
  GLYPH_POOL,
} from "../logic/weapons.mjs";

const IDLE = { direction: 0, jumpHeld: false, jumpPressed: false, firePressed: false };
const FIRE = { direction: 0, jumpHeld: false, jumpPressed: false, firePressed: true };
const RIGHT = { direction: 1, jumpHeld: false, jumpPressed: false, firePressed: false };
const LEFT = { direction: -1, jumpHeld: false, jumpPressed: false, firePressed: false };

function levelFrom(bottomRows) {
  const cols = bottomRows[0].length;
  const rows = [];
  for (let i = 0; i < 22 - bottomRows.length; i++) rows.push(".".repeat(cols));
  return parseLevel(rows.concat(bottomRows));
}

function armed(weapon, bottomRows) {
  const world = createWorld(levelFrom(bottomRows));
  world.hero.big = true;
  armWorld(world, weapon);
  return world;
}

function steps(world, input, seconds) {
  const events = [];
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) for (const event of stepWorld(world, input, STEP_SECONDS)) events.push(event);
  return events;
}

function fire(world) {
  return stepWorld(world, FIRE, STEP_SECONDS);
}

function enemy(world, kind) {
  return world.enemies.find(e => e.kind === kind);
}

const FLOOR = "#".repeat(40);

test("the same seed always gives the same weapon, and every weapon comes up", () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

  const weapons = seeds.map(weaponFor);

  assert.deepEqual(weapons, seeds.map(weaponFor));
  assert.deepEqual(new Set(weapons), new Set(WEAPON_IDS));
});

test("drawing the weapon never changes the levels of a seed", () => {
  const seed = 0x7f3a91c2;
  const before = [1, 2, 3].map(level => JSON.stringify(generateLevel(seed, level, 0)));

  weaponFor(seed);

  assert.deepEqual([1, 2, 3].map(level => JSON.stringify(generateLevel(seed, level, 0))), before);
});

const SUDO = levelFrom([".@.S........", "############"]);

function runUntilSudo(big) {
  const run = createRun(1, SUDO);
  run.world.hero.big = big;
  for (let i = 0; i < 2000 && !run.world.bits[0].collected; i++) stepRun(run, RIGHT, STEP_SECONDS);
  return run;
}

test("a sudo bit while big arms the hero with the seed's weapon, scores 500 and shows the hint", () => {
  const run = runUntilSudo(true);

  assert.deepEqual([run.armed, run.world.weapon, run.score, run.toast.text, run.hint.age < 0.1], [true, weaponFor(1), 500, WEAPONS[weaponFor(1)].toast, true]);
});

test("a sudo bit while small grows the hero but does not arm it", () => {
  const run = runUntilSudo(false);

  assert.deepEqual([run.world.hero.big, run.armed, run.world.weapon, run.hint], [true, false, null, null]);
});

test("the hint goes away after a few seconds, and soon after the first shot", () => {
  const waited = runUntilSudo(true);
  const fired = runUntilSudo(true);

  for (let i = 0; i <= Math.round(HINT_SECONDS / STEP_SECONDS); i++) stepRun(waited, IDLE, STEP_SECONDS);
  stepRun(fired, FIRE, STEP_SECONDS);
  for (let i = 0; i < Math.round((HINT_AFTER_FIRE_SECONDS + 0.05) / STEP_SECONDS); i++) stepRun(fired, IDLE, STEP_SECONDS);

  assert.deepEqual([waited.hint, fired.hint], [null, null]);
});

test("a hit takes sudo and the weapon together", () => {
  const run = runUntilSudo(true);

  hitHero(run, "bug");

  assert.deepEqual([run.world.hero.big, run.armed, run.world.weapon, run.hint], [false, false, null, null]);
});

test("a pit takes the weapon too", () => {
  const run = createRun(1, levelFrom([".@S.....", "###....."]));
  run.world.hero.big = true;

  for (let i = 0; i < 4000 && run.lives === 3; i++) stepRun(run, RIGHT, STEP_SECONDS);

  assert.deepEqual([run.lives, run.armed, run.world.weapon], [2, false, null]);
});

test("the weapon carries into the next level with sudo", () => {
  const run = runUntilSudo(true);

  nextLevel(run, SUDO);

  assert.deepEqual([run.world.hero.big, run.armed, run.world.weapon], [true, true, weaponFor(1)]);
});

test("nothing fires without a weapon", () => {
  const world = createWorld(levelFrom([".@....b.....", "############"]));
  world.hero.big = true;

  const events = fire(world);

  assert.deepEqual([events.filter(e => e.type === "fire").length, world.arms.shots.length], [0, 0]);
});

test("the duck kills a bug on the ground ahead like a stomp", () => {
  const world = armed("duck", [".@......b...", "############"]);

  fire(world);
  const events = steps(world, IDLE, 1);

  assert.deepEqual(events.filter(e => e.type === "kill").map(e => e.source), ["bug"]);
  assert.equal(enemy(world, "bug").alive, false);
});

test("the duck throws at most two at once and waits its cooldown between throws", () => {
  const world = armed("duck", [".@" + ".".repeat(38), FLOOR]);

  fire(world);
  const tooSoon = fire(world).filter(e => e.type === "fire").length;
  steps(world, IDLE, DUCK_COOLDOWN);
  fire(world);
  steps(world, IDLE, DUCK_COOLDOWN);
  fire(world);

  assert.deepEqual([tooSoon, world.arms.shots.length], [0, DUCK_LIMIT]);
});

test("the duck bounces along the ground and stays low", () => {
  const world = armed("duck", [".@" + ".".repeat(38), FLOOR]);
  const ground = 21 * TILE;
  let highest = ground;

  fire(world);
  for (let i = 0; i < 120; i++) {
    stepWorld(world, IDLE, STEP_SECONDS);
    if (world.arms.shots[0]) highest = Math.min(highest, world.arms.shots[0].y);
  }

  assert.ok(world.arms.shots.length === 1 && ground - highest < 1.5 * TILE, "peaked " + (ground - highest));
});

test("a wall stops the duck and a pit swallows it", () => {
  const wall = armed("duck", [".@...B......", "############"]);
  const pit = armed("duck", [".@......................", "####...................."]);

  const fizzle = steps(wall, FIRE, 0.5).filter(e => e.type === "fizzle").length;
  fire(pit);
  steps(pit, IDLE, 1.2);

  assert.deepEqual([fizzle > 0, wall.arms.shots.length, pit.arms.shots.length], [true, 0, 0]);
});

test("the duck flies under a floating zombie", () => {
  const world = armed("duck", [".@....z.....", "............", "............", "############"]);

  fire(world);
  steps(world, IDLE, 1);

  assert.equal(enemy(world, "zombie").alive, true);
});

test("traps absorb shots", () => {
  const world = armed("duck", [".@....d.....", "############"]);

  fire(world);
  const events = steps(world, IDLE, 0.5);

  assert.deepEqual([events.some(e => e.type === "fizzle"), enemy(world, "pointer").alive], [true, true]);
});

test("the duck bounces low enough to hit a bug at any point of its bounce", () => {
  for (let col = 4; col < 14; col++) {
    const world = armed("duck", [".@" + ".".repeat(col - 2) + "b" + ".".repeat(20 - col - 1), "#".repeat(20)]);
    enemy(world, "bug").homeX = enemy(world, "bug").x;

    fire(world);
    steps(world, IDLE, 1);

    assert.equal(enemy(world, "bug").alive, false, "bug at column " + col);
  }
});

test("a shot fork bomb splits as when stomped", () => {
  const world = armed("duck", [".@......f...", "############"]);

  fire(world);
  steps(world, IDLE, 1);

  assert.equal(world.enemies.filter(e => e.kind === "fork" && e.small && e.alive).length, 2);
});

test("shots kill the memory leak's source", () => {
  const run = createRun(1, levelFrom([".@...~~m......", "##############"]));
  run.world.hero.big = true;
  run.armed = true;
  armWorld(run.world, "revert");

  stepRun(run, FIRE, STEP_SECONDS);
  for (let i = 0; i < 120; i++) stepRun(run, IDLE, STEP_SECONDS);

  assert.deepEqual([enemy(run.world, "leak").alive, run.score], [false, LEAK_POINTS]);
});

test("a shot kill scores like a stomp", () => {
  const run = createRun(1, levelFrom([".@......b...", "############"]));
  run.world.hero.big = true;
  run.armed = true;
  armWorld(run.world, "duck");

  stepRun(run, FIRE, STEP_SECONDS);
  for (let i = 0; i < 120; i++) stepRun(run, IDLE, STEP_SECONDS);

  assert.deepEqual([run.score, run.stats.kills, run.popups[0].note], [KILL_POINTS, 1, "resolved"]);
});

test("the breakpoint pauses a bug instead of killing it", () => {
  const world = armed("breakpoint", [".@......b...", "############"]);
  const bug = enemy(world, "bug");

  fire(world);
  steps(world, IDLE, 1);
  const x = bug.x;
  steps(world, IDLE, 1);

  assert.deepEqual([bug.alive, bug.paused > 0, bug.x], [true, true, x]);
});

test("a paused enemy is harmless, and runs on when it thaws", () => {
  const world = armed("breakpoint", [".@....b.....", "############"]);
  const bug = enemy(world, "bug");
  fire(world);
  steps(world, IDLE, 0.5);

  const touched = steps(world, RIGHT, 1).filter(e => e.type === "hit");
  steps(world, IDLE, PAUSE_SECONDS);

  assert.deepEqual([touched.length, bug.paused], [0, 0]);
});

test("landing on a paused creature stomps it", () => {
  const world = armed("breakpoint", [".@....b.....", "############"]);
  fire(world);
  steps(world, IDLE, 0.5);
  world.hero.x = enemy(world, "bug").x;
  world.hero.y = 21 * TILE - 3 * TILE;

  const events = steps(world, IDLE, 0.5);

  assert.deepEqual(events.filter(e => e.type === "kill").map(e => e.source), ["bug"]);
});

test("the breakpoint pauses a trap, and the hero can stand on it", () => {
  const world = armed("breakpoint", [".@....d.....", "############"]);
  const pointer = enemy(world, "pointer");
  fire(world);
  steps(world, IDLE, 0.5);
  world.hero.x = pointer.x;
  world.hero.y = 21 * TILE - 2 * TILE;

  const events = steps(world, IDLE, 0.5);

  assert.deepEqual([pointer.paused > 0, world.hero.grounded, events.filter(e => e.type === "hit").length], [true, true, 0]);
  assert.ok(world.hero.y < 21 * TILE - 10, "stands on the paused emitter at " + world.hero.y);
});

test("the breakpoint has a long range, one shot at a time and a 1 s cooldown", () => {
  const far = armed("breakpoint", [".@........b..............", "#########################"]);
  const tooFar = armed("breakpoint", [".@.............b.........", "#########################"]);

  fire(far);
  fire(tooFar);
  const again = fire(far).filter(e => e.type === "fire").length;
  steps(far, IDLE, 1.5);
  steps(tooFar, IDLE, 1.5);

  assert.deepEqual([again, enemy(far, "bug").paused > 0, enemy(tooFar, "bug").paused], [0, true, 0]);
  assert.equal(BREAKPOINT_COOLDOWN, 1);
});

test("claude thinks, then kills the nearest enemy ahead at any height and comes back", () => {
  const world = armed("claude", [".@...z...b..", "............", "............", "############"]);

  const fired = fire(world).filter(e => e.type === "fire").length;
  const thinking = world.arms.spark.state;
  const events = steps(world, IDLE, 1.5);

  assert.deepEqual([fired, thinking], [1, "thinking"]);
  assert.deepEqual(events.filter(e => e.type === "kill").map(e => e.source), ["zombie"]);
  assert.deepEqual([world.arms.spark.state, world.arms.spark.say.text], ["idle", CLAUDE_LINES[0]]);
});

test("claude finds no issues behind the hero or beyond its reach", () => {
  const behind = armed("claude", [".b.@" + ".".repeat(20), "#".repeat(24)]);
  const far = armed("claude", [".@........b" + ".".repeat(13), "#".repeat(24)]);
  steps(behind, RIGHT, 0.05);
  behind.hero.vx = 0;

  fire(behind);
  fire(far);

  assert.deepEqual([behind.arms.spark.state, behind.arms.spark.say.text, far.arms.spark.say.text], ["idle", CLAUDE_NOTHING, CLAUDE_NOTHING]);
});

test("claude ignores traps", () => {
  const world = armed("claude", [".@..^^......", "############"]);

  fire(world);

  assert.equal(world.arms.spark.say.text, CLAUDE_NOTHING);
});

test("git revert passes through enemies, kills them on its way and comes back to be caught", () => {
  const world = armed("revert", [".@..b..b........", "################"]);

  fire(world);
  const again = fire(world).filter(e => e.type === "fire").length;
  const events = steps(world, IDLE, 2);

  assert.equal(again, 0);
  assert.deepEqual(events.filter(e => e.type === "kill").map(e => e.source), ["bug", "bug"]);
  assert.equal(world.arms.shots.length, 0);
});

test("git revert comes back to the hero wherever it walked", () => {
  const world = armed("revert", ["....@" + ".".repeat(20), "#".repeat(25)]);

  fire(world);
  steps(world, IDLE, 0.8);
  const turned = world.arms.shots[0].back;
  steps(world, LEFT, 2);

  assert.deepEqual([turned, world.arms.shots.length], [true, 0]);
});

test("a wall sends git revert back early", () => {
  const world = armed("revert", [".@..B...........", "################"]);

  fire(world);
  steps(world, IDLE, 0.15);

  assert.equal(world.arms.shots[0].back, true);
});

test("in the boss stage, shots kill the bugs the boss spawned", () => {
  const world = createWorld(arenaLevel(0x7f3a91c2));
  world.hero.big = true;
  armWorld(world, "duck");
  const bug = createEnemy({ kind: "bug", col: Math.floor(world.hero.x / TILE) + 5, row: Math.floor(world.hero.y / TILE) - 1 });
  world.boss.bugs.push(bug);

  fire(world);
  steps(world, IDLE, 1);

  assert.equal(bug.alive, false);
});

test("the weapon is drawn in the hand, and every shot and the spark are drawn", () => {
  const world = armed("duck", [".@" + ".".repeat(38), FLOOR]);
  const hand = { x: world.hero.x + 8, y: world.hero.y - 20 };

  const held = weaponGlyphs(world, hand, 1, 0).length;
  fire(world);
  steps(world, IDLE, DUCK_COOLDOWN);
  fire(world);
  const flying = weaponGlyphs(world, hand, 1, 0).length;

  assert.deepEqual([held, flying], [3, 9]);
  assert.ok(flying <= GLYPH_POOL);
  assert.deepEqual(weaponGlyphs(createWorld(SUDO), hand, 1, 0), []);
});

test("the dev shortcut arms a small hero at once with the weapon it is given", () => {
  const run = createRun(1, SUDO);

  armHero(run, "revert");

  assert.deepEqual([run.world.hero.big, run.armed, run.world.weapon, run.toast.text, run.hint.age], [true, true, "revert", WEAPONS.revert.toast, 0]);
});

test("the small fork bombs from a shot fork bomb do not hurt the hero standing next to it", () => {
  const world = armed("revert", [".@.f........", "############"]);

  fire(world);
  const events = steps(world, IDLE, 0.9);

  assert.deepEqual([events.filter(e => e.type === "kill").map(e => e.source), events.filter(e => e.type === "hit").length], [["fork"], 0]);
});
