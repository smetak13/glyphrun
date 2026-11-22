import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEnemy,
  pingHeight,
  stepEnemies,
  touchEnemies,
  BUG_SPEED,
  HANG_LIE_SECONDS,
  HANG_WINDUP_SPEED,
  PING_AIR_SECONDS,
  PING_GROUND_SECONDS,
  PING_HOP_HEIGHT,
  ZOMBIE_BOB,
  ZOMBIE_RANGE,
} from "../logic/enemies.mjs";
import { createWorld, respawnHero, stepWorld } from "../logic/world.mjs";
import { createRun, stepRun, LIVES } from "../logic/run.mjs";
import { createHero } from "../logic/physics.mjs";
import { parseLevel } from "../logic/level.mjs";
import { STEP_SECONDS } from "../logic/clock.mjs";
import { TILE } from "../logic/screen.mjs";

const IDLE = { direction: 0, jumpHeld: false, jumpPressed: false };
const FAR_AWAY = createHero(-1000, 0);

function levelFrom(bottomRows, topRows) {
  const cols = bottomRows[0].length;
  const rows = (topRows || []).map(row => row.padEnd(cols, "."));
  while (rows.length < 22 - bottomRows.length) rows.push(".".repeat(cols));
  return parseLevel(rows.concat(bottomRows));
}

function stepFor(enemies, level, hero, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) stepEnemies(enemies, level, hero, STEP_SECONDS);
}

function enemiesOf(level) {
  return level.enemies.map(createEnemy);
}

function worldEventsUntil(world, input, done) {
  const events = [];
  for (let i = 0; i < 2000 && !done(events); i++) for (const event of stepWorld(world, input, STEP_SECONDS)) events.push(event);
  return events;
}

function dropHeroOnto(world, enemy) {
  const hero = world.hero;
  hero.x = enemy.x;
  hero.y = enemy.y - enemy.height - 12;
  hero.vy = 120;
  hero.grounded = false;
}

function heroTouchingFromSide(world, enemy) {
  world.hero.x = enemy.x - enemy.width / 2 - 4;
  world.hero.y = enemy.y;
}

function kinds(events) {
  return events.filter(e => e.type === "hit" || e.type === "kill").map(e => e.type + " " + e.source);
}

test("level maps place each basic enemy on its tile", () => {
  const level = levelFrom(["@b.z.o.v.^^^", "############"]);

  assert.deepEqual(
    level.enemies.map(e => [e.kind, e.col, e.tiles || 1]),
    [["bug", 1, 1], ["zombie", 3, 1], ["ping", 5, 1], ["hang", 7, 1], ["spikes", 9, 3]],
  );
});

test("an enemy stands on the floor of its tile", () => {
  const [bug] = enemiesOf(levelFrom(["....b...", "########"]));

  assert.deepEqual([bug.x, bug.y], [4.5 * TILE, 21 * TILE]);
});

test("a bug walks along the ground at its speed", () => {
  const level = levelFrom(["..........b.........", "####################"]);
  const [bug] = enemiesOf(level);

  stepFor([bug], level, FAR_AWAY, 1);

  assert.ok(Math.abs(bug.x - (10.5 * TILE - BUG_SPEED)) < 0.01);
});

test("a bug turns around at a wall", () => {
  const level = levelFrom(["..B..b......", "############"]);
  const [bug] = enemiesOf(level);

  stepFor([bug], level, FAR_AWAY, 3);

  assert.ok(bug.x - bug.width / 2 >= 3 * TILE - 0.01);
  assert.equal(bug.direction, 1);
});

test("a bug turns around at a ledge instead of falling into a pit", () => {
  const level = levelFrom(["......b.....", "###.########"]);
  const [bug] = enemiesOf(level);

  stepFor([bug], level, FAR_AWAY, 4);

  assert.ok(bug.x - bug.width / 2 >= 4 * TILE - 0.01);
  assert.equal(bug.y, 21 * TILE);
});

test("a bug turns around at the end of a platform", () => {
  const level = levelFrom(["..........", "...b......", "..====....", "..........", "##########"]);
  const [bug] = enemiesOf(level);

  stepFor([bug], level, FAR_AWAY, 8);

  assert.ok(bug.x - bug.width / 2 >= 2 * TILE - 0.01 && bug.x + bug.width / 2 <= 6 * TILE + 0.01);
});

test("two bugs turn around when they meet", () => {
  const level = levelFrom(["..b....b....", "############"]);
  const [left, right] = enemiesOf(level);
  left.direction = 1;

  stepFor([left, right], level, FAR_AWAY, 3);

  assert.ok(right.x - left.x >= (left.width + right.width) / 2 - 0.01);
  assert.deepEqual([left.direction, right.direction], [-1, 1]);
});

test("a bug turns around at kernel spikes", () => {
  const level = levelFrom([".^..b.......", "############"]);
  const enemies = enemiesOf(level);

  stepFor(enemies, level, FAR_AWAY, 3);

  assert.equal(enemies[1].direction, 1);
});

test("a stomped bug dies and the hero bounces", () => {
  const world = createWorld(levelFrom(["@.....b.....", "############"]));
  const bug = world.enemies[0];
  dropHeroOnto(world, bug);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["kill bug"]);
  assert.equal(bug.alive, false);
  assert.ok(world.hero.vy < 0);
});

test("touching a bug from the side is a hit", () => {
  const world = createWorld(levelFrom(["@.....b.....", "############"]));
  heroTouchingFromSide(world, world.enemies[0]);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["hit bug"]);
});

test("a zombie floats back and forth within its stretch and bobs", () => {
  const level = levelFrom(["####################"], ["", "..........z"]);
  const [zombie] = enemiesOf(level);
  const xs = [];
  const ys = [];

  for (let i = 0; i < 1200; i++) {
    stepEnemies([zombie], level, FAR_AWAY, STEP_SECONDS);
    xs.push(zombie.x);
    ys.push(zombie.y);
  }

  assert.ok(Math.min.apply(null, xs) >= zombie.homeX - ZOMBIE_RANGE - 0.01);
  assert.ok(Math.max.apply(null, xs) <= zombie.homeX + ZOMBIE_RANGE + 0.01);
  assert.ok(Math.max.apply(null, xs) - Math.min.apply(null, xs) > ZOMBIE_RANGE);
  assert.ok(Math.max.apply(null, ys) - Math.min.apply(null, ys) > ZOMBIE_BOB);
});

test("a zombie turns around at a wall inside its stretch", () => {
  const level = levelFrom(["####################"], ["", ".........Bz"]);
  const [zombie] = enemiesOf(level);

  stepFor([zombie], level, FAR_AWAY, 1);

  assert.ok(zombie.x - zombie.width / 2 >= 10 * TILE - 0.01);
});

test("a zombie dies to a stomp and hurts from the side", () => {
  const stompWorld = createWorld(levelFrom(["@.....z.....", "############"]));
  const sideWorld = createWorld(levelFrom(["@.....z.....", "############"]));
  dropHeroOnto(stompWorld, stompWorld.enemies[0]);
  heroTouchingFromSide(sideWorld, sideWorld.enemies[0]);

  const stomp = worldEventsUntil(stompWorld, IDLE, e => e.length > 0);
  const side = worldEventsUntil(sideWorld, IDLE, e => e.length > 0);

  assert.deepEqual([kinds(stomp), kinds(side)], [["kill zombie"], ["hit zombie"]]);
});

test("kernel spikes stay put and hurt even when landed on", () => {
  const world = createWorld(levelFrom(["@....^^^....", "############"]));
  const spikes = world.enemies[0];
  dropHeroOnto(world, spikes);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["hit spikes"]);
  assert.deepEqual([spikes.alive, spikes.x], [true, 6.5 * TILE]);
});

test("kernel spikes on a platform hurt the hero standing on it", () => {
  const world = createWorld(levelFrom(["....", "@.^...", "======", "......", "######"].map(r => r.padEnd(8, "."))));
  world.hero.x = 2.5 * TILE;
  world.hero.y = 19 * TILE;

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["hit spikes"]);
});

test("a ping waits on the ground, then hops up and comes back down in rhythm", () => {
  const cycle = PING_GROUND_SECONDS + PING_AIR_SECONDS;

  assert.equal(pingHeight(0), 0);
  assert.equal(pingHeight(PING_GROUND_SECONDS - 0.01), 0);
  assert.ok(Math.abs(pingHeight(PING_GROUND_SECONDS + PING_AIR_SECONDS / 2) - PING_HOP_HEIGHT) < 0.01);
  assert.equal(pingHeight(cycle + 0.1), 0);
  assert.equal(pingHeight(cycle + PING_GROUND_SECONDS + 0.2), pingHeight(PING_GROUND_SECONDS + 0.2));
});

test("a ping hops in place", () => {
  const level = levelFrom(["....o...", "########"]);
  const [ping] = enemiesOf(level);

  stepFor([ping], level, FAR_AWAY, PING_GROUND_SECONDS + PING_AIR_SECONDS / 2);

  assert.equal(ping.x, ping.homeX);
  assert.ok(ping.homeY - ping.y > PING_HOP_HEIGHT - 1);
});

test("the hero passes under a ping at the top of its hop", () => {
  const level = levelFrom(["....o...", "########"]);
  const [ping] = enemiesOf(level);
  const hero = createHero(ping.x, ping.homeY);
  stepFor([ping], level, hero, PING_GROUND_SECONDS + PING_AIR_SECONDS / 2);

  const events = touchEnemies([ping], hero, hero.y);

  assert.deepEqual(events, []);
});

test("a ping dies to a stomp while on the ground", () => {
  const world = createWorld(levelFrom(["@.....o.....", "############"]));
  dropHeroOnto(world, world.enemies[0]);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["kill ping"]);
});

test("a ping dies to a stomp in the middle of its hop", () => {
  const world = createWorld(levelFrom(["@.....o.....", "############"]));
  const ping = world.enemies[0];
  stepFor([ping], world.level, FAR_AWAY, PING_GROUND_SECONDS + PING_AIR_SECONDS / 2);
  dropHeroOnto(world, ping);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["kill ping"]);
});

test("a ping hopping up into a hero coming down from above dies", () => {
  const world = createWorld(levelFrom(["@.....o.....", "############"]));
  const ping = world.enemies[0];
  stepFor([ping], world.level, FAR_AWAY, PING_GROUND_SECONDS + 0.05);
  world.hero.x = ping.x;
  world.hero.y = ping.y - ping.height - 4;
  world.hero.vy = 300;
  world.hero.grounded = false;

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["kill ping"]);
});

test("a ping in the air at the hero's height hurts from the side", () => {
  const level = levelFrom(["....o...", "########"]);
  const [ping] = enemiesOf(level);
  stepFor([ping], level, FAR_AWAY, PING_GROUND_SECONDS + PING_AIR_SECONDS / 2);
  const hero = createHero(ping.x - ping.width / 2 - 4, ping.y);

  const events = touchEnemies([ping], hero, hero.y);

  assert.deepEqual(kinds(events), ["hit ping"]);
});

const HANG_LEVEL = levelFrom(["@...........", "############"], ["", "", "", "......v....."]);

test("a hang stays up while the hero is not beneath it", () => {
  const [hang] = enemiesOf(HANG_LEVEL);

  stepFor([hang], HANG_LEVEL, createHero(2 * TILE, 21 * TILE), 2);

  assert.deepEqual([hang.state, hang.y], ["hanging", 4 * TILE]);
});

test("a hang drops when the hero passes beneath and lands on the ground", () => {
  const [hang] = enemiesOf(HANG_LEVEL);

  stepFor([hang], HANG_LEVEL, createHero(hang.x - TILE, 21 * TILE), 0.05);
  const state = hang.state;
  stepFor([hang], HANG_LEVEL, FAR_AWAY, 1);

  assert.deepEqual([state, hang.state, hang.y], ["falling", "lying", 21 * TILE]);
});

test("a hang lies on the ground for a moment, then slowly winds back up and hangs again", () => {
  const [hang] = enemiesOf(HANG_LEVEL);
  stepEnemies([hang], HANG_LEVEL, createHero(hang.x, 21 * TILE), STEP_SECONDS);
  while (hang.state !== "lying") stepEnemies([hang], HANG_LEVEL, FAR_AWAY, STEP_SECONDS);

  stepFor([hang], HANG_LEVEL, FAR_AWAY, HANG_LIE_SECONDS - 0.05);
  const stillLying = hang.state;
  stepFor([hang], HANG_LEVEL, FAR_AWAY, 1);
  const rose = 21 * TILE - hang.y;
  stepFor([hang], HANG_LEVEL, FAR_AWAY, (17 * TILE) / HANG_WINDUP_SPEED);

  assert.equal(stillLying, "lying");
  assert.ok(Math.abs(rose - (HANG_WINDUP_SPEED * 0.95)) < 1);
  assert.deepEqual([hang.state, hang.y], ["hanging", 4 * TILE]);
});

test("a hang dies to a stomp while it falls", () => {
  const world = createWorld(HANG_LEVEL);
  const hang = world.enemies[0];
  stepEnemies([hang], HANG_LEVEL, createHero(hang.x, 21 * TILE), STEP_SECONDS);
  stepFor([hang], HANG_LEVEL, FAR_AWAY, 0.2);
  dropHeroOnto(world, hang);
  world.hero.vy = 600;

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual([hang.state, kinds(events)], ["falling", ["kill hang"]]);
});

test("a falling hang hurts the hero beneath it", () => {
  const world = createWorld(HANG_LEVEL);
  world.hero.x = world.enemies[0].x;

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["hit hang"]);
});

test("a hang dies to a stomp while it lies on the ground", () => {
  const world = createWorld(HANG_LEVEL);
  const hang = world.enemies[0];
  stepEnemies([hang], HANG_LEVEL, createHero(hang.x, 21 * TILE), STEP_SECONDS);
  while (hang.state !== "lying") stepEnemies([hang], HANG_LEVEL, FAR_AWAY, STEP_SECONDS);
  dropHeroOnto(world, hang);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["kill hang"]);
});

test("a hang dies to a stomp while it winds up", () => {
  const world = createWorld(HANG_LEVEL);
  const hang = world.enemies[0];
  stepEnemies([hang], HANG_LEVEL, createHero(hang.x, 21 * TILE), STEP_SECONDS);
  while (hang.state !== "winding") stepEnemies([hang], HANG_LEVEL, FAR_AWAY, STEP_SECONDS);
  stepFor([hang], HANG_LEVEL, FAR_AWAY, 0.5);
  dropHeroOnto(world, hang);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["kill hang"]);
});

test("respawning puts living enemies back where they started and keeps killed ones dead", () => {
  const world = createWorld(levelFrom(["@.....b...b.", "############"]));
  const [killed, walker] = world.enemies;
  killed.alive = false;
  for (let i = 0; i < 60; i++) stepWorld(world, IDLE, STEP_SECONDS);

  respawnHero(world);

  assert.deepEqual([killed.alive, walker.x], [false, walker.homeX]);
});

test("stomping an enemy scores its kill with the kill message", () => {
  const run = createRun(1, levelFrom(["@.....b.....", "############"]));
  dropHeroOnto(run.world, run.world.enemies[0]);

  for (let i = 0; i < 60; i++) stepRun(run, IDLE, STEP_SECONDS);

  assert.equal(run.score, 100);
  assert.deepEqual(run.popups.map(p => p.note), ["resolved"]);
});

test("an enemy hit while small costs a life and names the enemy", () => {
  const run = createRun(1, levelFrom(["@.....o.....", "############"]));
  heroTouchingFromSide(run.world, run.world.enemies[0]);

  stepRun(run, IDLE, STEP_SECONDS);

  assert.deepEqual([run.lives, run.toast.text], [LIVES - 1, "request timed out"]);
});
