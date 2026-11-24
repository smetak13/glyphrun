import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEnemies,
  createEnemy,
  cronState,
  pingHeight,
  pipeRaise,
  pointerWarning,
  stepEnemies,
  touchEnemies,
  BUG_SPEED,
  CRON_FIRE_SECONDS,
  CRON_HEIGHTS,
  LEAK_EMPTY_SECONDS,
  LEAK_FULL_SECONDS,
  LEAK_GROW_SPEED,
  LEAK_SHRINK_SPEED,
  PIPE_DOWN_SECONDS,
  PIPE_JITTER_SECONDS,
  PIPE_MOVE_SECONDS,
  PIPE_RISE,
  PIPE_UP_SECONDS,
  POINTER_FIRST_SHOT_SECONDS,
  POINTER_PERIOD,
  POINTER_WARNING_SECONDS,
  SHOT_LENGTH,
  SHOT_SPEED,
  SMALL_FORK_SPEED,
  SPLIT_GRACE_SECONDS,
  SPINLOCK_PERIOD,
  SPINLOCK_SPACING,
  leakCycleSeconds,
  HANG_LIE_SECONDS,
  HANG_TRIGGER_DISTANCE,
  HANG_WINDUP_SPEED,
  PING_AIR_SECONDS,
  PING_GROUND_SECONDS,
  PING_HOP_HEIGHT,
  ZOMBIE_BOB,
  ZOMBIE_RANGE,
  STOMP_BOUNCE_VELOCITY,
} from "../logic/enemies.mjs";
import { createWorld, respawnHero, stepWorld } from "../logic/world.mjs";
import { createRun, stepRun, LIVES } from "../logic/run.mjs";
import { computeEnvelope, createHero, JUMP_VELOCITY, WALK_SPEED } from "../logic/physics.mjs";
import { parseLevel } from "../logic/level.mjs";
import { STEP_SECONDS } from "../logic/clock.mjs";
import { TILE } from "../logic/screen.mjs";

const IDLE = { direction: 0, jumpHeld: false, jumpPressed: false };
const FAR_AWAY = createHero(-1000, 0);

function levelFrom(bottomRows, topRows, middleRows) {
  const cols = bottomRows[0].length;
  const rows = (topRows || []).map(row => row.padEnd(cols, "."));
  const middle = middleRows || [];
  while (rows.length < 22 - bottomRows.length - middle.length) rows.push(".".repeat(cols));
  return parseLevel(rows.concat(middle, bottomRows));
}

function stepFor(enemies, level, hero, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) stepEnemies(enemies, level, hero, STEP_SECONDS);
}

function enemiesOf(level) {
  return createEnemies(level.enemies);
}

function steps(world, count) {
  for (let i = 0; i < count; i++) stepWorld(world, IDLE, STEP_SECONDS);
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

function stompOnBug(pressedOnStep) {
  const world = createWorld(levelFrom(["@.....b.....", "############"]));
  const bug = world.enemies[0];
  dropHeroOnto(world, bug);
  let stompedOnStep = null;
  let fastestRise = 0;
  for (let step = 0; step < 60; step++) {
    stepWorld(world, { direction: 0, jumpHeld: true, jumpPressed: step === pressedOnStep }, STEP_SECONDS);
    if (!bug.alive && stompedOnStep === null) stompedOnStep = step;
    if (!bug.alive) fastestRise = Math.max(fastestRise, -world.hero.vy);
  }
  return { stompedOnStep, fastestRise };
}

test("pressing jump just before or just after a stomp jumps off the enemy like off the ground", () => {
  const stomp = stompOnBug(null).stompedOnStep;

  const before = stompOnBug(stomp - 5).fastestRise;
  const after = stompOnBug(stomp + 5).fastestRise;
  const tooLate = stompOnBug(stomp + 30).fastestRise;
  const heldOnly = stompOnBug(null).fastestRise;

  assert.ok(Math.abs(before - JUMP_VELOCITY) < 30, "before: " + before);
  assert.ok(Math.abs(after - JUMP_VELOCITY) < 30, "after: " + after);
  assert.ok(Math.abs(tooLate - STOMP_BOUNCE_VELOCITY) < 1, "too late: " + tooLate);
  assert.ok(Math.abs(heldOnly - STOMP_BOUNCE_VELOCITY) < 1, "held only: " + heldOnly);
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

test("a hang stays up while the hero is farther away than its trigger distance", () => {
  const [hang] = enemiesOf(HANG_LEVEL);

  stepFor([hang], HANG_LEVEL, createHero(hang.x - HANG_TRIGGER_DISTANCE - TILE, 21 * TILE), 2);

  assert.deepEqual([hang.state, hang.y], ["hanging", 4 * TILE]);
});

test("a hang drops when the hero passes beneath and lands on the ground", () => {
  const [hang] = enemiesOf(HANG_LEVEL);

  stepFor([hang], HANG_LEVEL, createHero(hang.x - TILE, 21 * TILE), 0.05);
  const state = hang.state;
  stepFor([hang], HANG_LEVEL, FAR_AWAY, 1);

  assert.deepEqual([state, hang.state, hang.y], ["falling", "lying", 21 * TILE]);
});

const RUNWAY = levelFrom(["@.......................................", "########################################"], ["", "", "", "", "..............................v"]);

function runTowardHang(reactionSeconds) {
  const world = createWorld(RUNWAY);
  const hang = world.enemies[0];
  world.hero.vx = WALK_SPEED;
  let fellAt = null;
  for (let i = 0; i < 1200; i++) {
    if (fellAt === null && hang.state === "falling") fellAt = world.time;
    const braking = reactionSeconds !== null && fellAt !== null && world.time - fellAt > reactionSeconds;
    const events = stepWorld(world, { direction: braking ? 0 : 1, jumpHeld: false, jumpPressed: false }, STEP_SECONDS);
    if (events.some(event => event.type === "hit")) return true;
  }
  return false;
}

test("a hang drops onto a hero running beneath it at full speed", () => {
  assert.equal(runTowardHang(null), true);
});

test("a running hero that brakes when the hang starts to drop is not hit", () => {
  assert.equal(runTowardHang(0.25), false);
});

test("a falling hang drops through a platform to the ground beneath", () => {
  const level = levelFrom(["............", "....======..", "............", "............", "############"], ["", "", "", "......v....."]);
  const [hang] = enemiesOf(level);
  stepEnemies([hang], level, createHero(hang.x, 21 * TILE), STEP_SECONDS);

  while (hang.state === "falling") stepEnemies([hang], level, FAR_AWAY, STEP_SECONDS);

  assert.deepEqual([hang.state, hang.y], ["lying", 21 * TILE]);
});

test("a hang stops on a solid block", () => {
  const level = levelFrom(["............", "....BBBBBB..", "............", "............", "############"], ["", "", "", "......v....."]);
  const [hang] = enemiesOf(level);
  stepEnemies([hang], level, createHero(hang.x, 21 * TILE), STEP_SECONDS);

  while (hang.state === "falling") stepEnemies([hang], level, FAR_AWAY, STEP_SECONDS);

  assert.equal(hang.y, 18 * TILE);
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

function harmsHeroAt(enemy, x, y) {
  return touchEnemies([enemy], createHero(x, y), y).some(event => event.type === "hit");
}

const GROUND_Y = 21 * TILE;

test("level maps place each advanced enemy, a pipe with its width and a leak with its frame", () => {
  const level = levelFrom(["@cdf..HH.~~~m", "#############"], [], ["......p......", "......HH....."]);

  assert.deepEqual(
    level.enemies.map(e => [e.kind, e.col, e.tiles || e.extent || 1]),
    [["pipe", 6, 2], ["cron", 1, 1], ["pointer", 2, 1], ["fork", 3, 1], ["leak", 12, 3]],
  );
});

const CRON_LEVEL = levelFrom(["@.....c.....", "############"]);

test("a cron vent idles, then fires for a while in its rhythm, with no warning", () => {
  const [cron] = enemiesOf(CRON_LEVEL);
  const fireAt = cron.period - CRON_FIRE_SECONDS;
  const stateAt = seconds => {
    cron.time = seconds;
    return cronState(cron);
  };

  assert.deepEqual(
    [stateAt(0), stateAt(fireAt - 0.01), stateAt(fireAt + 0.01), stateAt(cron.period - 0.01), stateAt(cron.period + 0.01)],
    ["idle", "idle", "firing", "firing", "idle"],
  );
});

test("a cron column is higher than the hero can jump", () => {
  const cron = createEnemy({ kind: "cron", col: 6, row: 20, height: Math.min.apply(null, CRON_HEIGHTS) });
  cron.time = cron.period - CRON_FIRE_SECONDS + 0.1;

  assert.equal(harmsHeroAt(cron, cron.x, GROUND_Y - computeEnvelope().maxJumpHeight), true);
});

test("a cron vent's phase shifts its rhythm", () => {
  const [plain] = enemiesOf(CRON_LEVEL);
  const shifted = createEnemy({ kind: "cron", col: 6, row: 20, phase: 1 });
  shifted.time = 0;
  plain.time = 1;

  assert.equal(cronState(shifted), cronState(plain));
});

test("a cron column hurts up to its height only while it fires", () => {
  const cron = createEnemy({ kind: "cron", col: 6, row: 20, height: 5 });
  cron.time = cron.period - CRON_FIRE_SECONDS + 0.1;
  const firingLow = harmsHeroAt(cron, cron.x, GROUND_Y);
  const firingHigh = harmsHeroAt(cron, cron.x, GROUND_Y - 4.5 * TILE);
  const firingAbove = harmsHeroAt(cron, cron.x, GROUND_Y - 6 * TILE);
  cron.time = 0;

  assert.deepEqual([firingLow, firingHigh, firingAbove, harmsHeroAt(cron, cron.x, GROUND_Y)], [true, true, false, false]);
});

test("a cron vent cannot be stomped", () => {
  const world = createWorld(CRON_LEVEL);
  const cron = world.enemies[0];
  cron.time = cron.period - CRON_FIRE_SECONDS + 0.1;
  world.hero.x = cron.x;
  world.hero.y = GROUND_Y - 3 * TILE;
  world.hero.vy = 300;
  world.hero.grounded = false;

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["hit cron"]);
});

const PIPE_LEVEL = levelFrom(["@.....HH....", "############"], [], ["......p.....", "......HH....", "......HH...."]);
const PIPE_TOP = 18 * TILE;

function pipeOf(level, jitter) {
  return createEnemies(level.enemies.map(slot => Object.assign({}, slot, { jitter })))[0];
}

function raisedTimes(pipe, seconds) {
  const changes = [];
  let up = false;
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) {
    stepEnemies([pipe], PIPE_LEVEL, FAR_AWAY, STEP_SECONDS);
    const nowUp = pipe.y < pipe.homeY + PIPE_RISE;
    if (nowUp !== up) changes.push(Math.round(pipe.time * 100) / 100);
    up = nowUp;
  }
  return changes;
}

test("a pipe daemon stays down, rises, stays up briefly and sinks back", () => {
  assert.equal(pipeRaise(0), 0);
  assert.ok(pipeRaise(PIPE_MOVE_SECONDS / 2) > 0 && pipeRaise(PIPE_MOVE_SECONDS / 2) < PIPE_RISE);
  assert.equal(pipeRaise(PIPE_MOVE_SECONDS + PIPE_UP_SECONDS / 2), PIPE_RISE);
  assert.equal(pipeRaise(2 * PIPE_MOVE_SECONDS + PIPE_UP_SECONDS + 0.01), 0);
});

test("a pipe daemon's time down varies a little from cycle to cycle, the same way for the same jitter seed", () => {
  const first = raisedTimes(pipeOf(PIPE_LEVEL, 7), 20);
  const again = raisedTimes(pipeOf(PIPE_LEVEL, 7), 20);
  const other = raisedTimes(pipeOf(PIPE_LEVEL, 8), 20);
  const downs = [first[0]];
  for (let i = 2; i < first.length; i += 2) downs.push(first[i] - first[i - 1]);

  assert.deepEqual(first, again);
  assert.notDeepEqual(first, other);
  assert.ok(downs.every(down => down >= PIPE_DOWN_SECONDS - 0.02 && down <= PIPE_DOWN_SECONDS + PIPE_JITTER_SECONDS + 0.02), downs.join(" "));
  assert.ok(Math.max.apply(null, downs) - Math.min.apply(null, downs) > 0.05);
});

test("the pipe is solid: the hero stands on it and a walker turns at it", () => {
  const world = createWorld(PIPE_LEVEL);
  world.hero.x = 7 * TILE;
  world.hero.y = PIPE_TOP - 30;
  world.hero.grounded = false;
  const bugLevel = levelFrom(["..........b.", "......HH....", "############"]);
  const [bug] = enemiesOf(bugLevel);

  steps(world, 30);
  stepFor([bug], bugLevel, FAR_AWAY, 4);

  assert.equal(world.hero.y, PIPE_TOP);
  assert.ok(bug.x - bug.width / 2 >= 8 * TILE - 0.01);
});

test("with the daemon out, no jump clears the pipe", () => {
  const pipe = pipeOf(PIPE_LEVEL, 0);
  while (pipe.y > pipe.homeY) stepEnemies([pipe], PIPE_LEVEL, FAR_AWAY, STEP_SECONDS);

  assert.equal(harmsHeroAt(pipe, pipe.x, GROUND_Y - computeEnvelope().maxJumpHeight), true);
});

test("a pipe daemon hurts a hero on the pipe while it is up, and not while it is down", () => {
  const pipe = pipeOf(PIPE_LEVEL, 0);
  const downHarm = harmsHeroAt(pipe, pipe.x, PIPE_TOP);
  while (pipe.y > pipe.homeY) stepEnemies([pipe], PIPE_LEVEL, FAR_AWAY, STEP_SECONDS);

  assert.deepEqual([downHarm, harmsHeroAt(pipe, pipe.x, PIPE_TOP)], [false, true]);
});

const POINTER_LEVEL = levelFrom(["@.....................d.", "########################"]);
const WALLED_POINTER_LEVEL = levelFrom(["@.B..................d.", "#######################"]);
const ON_SCREEN = 0;
const OFF_SCREEN = 30 * TILE;

function stepOnCamera(enemies, level, seconds, cameraX) {
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) stepEnemies(enemies, level, FAR_AWAY, STEP_SECONDS, cameraX);
}

test("a dangling pointer fires only while it is on screen", () => {
  const [offScreen] = enemiesOf(POINTER_LEVEL);
  const [onScreen] = enemiesOf(POINTER_LEVEL);

  stepOnCamera([offScreen], POINTER_LEVEL, POINTER_PERIOD, OFF_SCREEN);
  stepOnCamera([onScreen], POINTER_LEVEL, POINTER_FIRST_SHOT_SECONDS + 0.01, ON_SCREEN);

  assert.deepEqual([offScreen.shots.length, onScreen.shots.length], [0, 1]);
});

test("a dangling pointer blinks before each shot, then fires in its rhythm", () => {
  const [pointer] = enemiesOf(POINTER_LEVEL);
  stepOnCamera([pointer], POINTER_LEVEL, POINTER_FIRST_SHOT_SECONDS - POINTER_WARNING_SECONDS - 0.02, ON_SCREEN);
  const before = pointerWarning(pointer);
  stepOnCamera([pointer], POINTER_LEVEL, 0.04, ON_SCREEN);
  const warning = pointerWarning(pointer);
  stepOnCamera([pointer], POINTER_LEVEL, POINTER_WARNING_SECONDS, ON_SCREEN);
  const afterShot = [pointerWarning(pointer), pointer.shots.length];
  stepOnCamera([pointer], POINTER_LEVEL, POINTER_PERIOD, ON_SCREEN);

  assert.deepEqual([before, warning, afterShot, pointer.shots.length], [false, true, [false, 1], 2]);
});

test("a dangling pointer with a delay fires its first shot that much later, then in its rhythm", () => {
  const [pointer] = createEnemies([Object.assign({}, POINTER_LEVEL.enemies[0], { phase: 0.8 })]);
  stepOnCamera([pointer], POINTER_LEVEL, POINTER_FIRST_SHOT_SECONDS + 0.7, ON_SCREEN);
  const early = pointer.shots.length;
  stepOnCamera([pointer], POINTER_LEVEL, 0.2, ON_SCREEN);
  const first = pointer.shots.length;
  stepOnCamera([pointer], POINTER_LEVEL, POINTER_PERIOD, ON_SCREEN);

  assert.deepEqual([early, first, pointer.shots.length], [0, 1, 2]);
});

test("a pointer's shot flies left at its speed and hurts the hero it meets", () => {
  const [pointer] = enemiesOf(POINTER_LEVEL);
  stepOnCamera([pointer], POINTER_LEVEL, POINTER_FIRST_SHOT_SECONDS + 0.01, ON_SCREEN);
  const firedAt = pointer.shots[0];
  stepOnCamera([pointer], POINTER_LEVEL, 0.5, OFF_SCREEN);
  const shot = pointer.shots[0];

  assert.ok(Math.abs(firedAt - shot - SHOT_SPEED * 0.5) < 1);
  assert.equal(harmsHeroAt(pointer, shot + SHOT_LENGTH / 2, GROUND_Y), true);
  assert.equal(harmsHeroAt(pointer, shot + SHOT_LENGTH / 2, GROUND_Y - 2 * TILE), false);
});

test("a pointer's shot stops at a wall", () => {
  const [pointer] = enemiesOf(WALLED_POINTER_LEVEL);

  stepOnCamera([pointer], WALLED_POINTER_LEVEL, POINTER_FIRST_SHOT_SECONDS + 0.01, ON_SCREEN);
  stepOnCamera([pointer], WALLED_POINTER_LEVEL, 3, OFF_SCREEN);

  assert.deepEqual(pointer.shots, []);
});

test("a pointer two tiles up fires over a small hero and into a big one", () => {
  const level = levelFrom(["@....................d.", "@....................B.", "#######################"]);
  const [pointer] = enemiesOf(level);
  stepOnCamera([pointer], level, POINTER_FIRST_SHOT_SECONDS + 0.5, ON_SCREEN);
  const x = pointer.shots[0] + SHOT_LENGTH / 2;
  const big = createHero(x, GROUND_Y);
  big.big = true;

  assert.equal(harmsHeroAt(pointer, x, GROUND_Y), false);
  assert.equal(touchEnemies([pointer], big, big.y).some(event => event.type === "hit"), true);
});

test("a dangling pointer cannot be stomped", () => {
  const world = createWorld(POINTER_LEVEL);
  dropHeroOnto(world, world.enemies[0]);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["hit pointer"]);
});

const FORK_LEVEL = levelFrom(["@B.......f.......B..", "####################"]);

test("a fork bomb walks like a bug", () => {
  const level = levelFrom(["..........f.........", "####################"]);
  const [fork] = enemiesOf(level);

  stepFor([fork], level, FAR_AWAY, 1);

  assert.ok(Math.abs(fork.x - (10.5 * TILE - BUG_SPEED)) < 0.01);
});

test("a stomped fork bomb splits into two small ones running apart, faster", () => {
  const world = createWorld(FORK_LEVEL);
  const [fork, left, right] = world.enemies;
  dropHeroOnto(world, fork);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);
  steps(world, 60);

  assert.deepEqual(kinds(events), ["kill fork"]);
  assert.deepEqual([fork.alive, left.alive, right.alive, left.small, right.small], [false, true, true, true, true]);
  assert.ok(left.x < fork.x - SMALL_FORK_SPEED * 0.4 && right.x > fork.x + SMALL_FORK_SPEED * 0.4);
  assert.ok(SMALL_FORK_SPEED > BUG_SPEED);
});

test("the small fork bombs do not die to the stomp that split them", () => {
  const world = createWorld(FORK_LEVEL);
  dropHeroOnto(world, world.enemies[0]);

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);
  for (let i = 0; i < 60; i++) for (const event of stepWorld(world, IDLE, STEP_SECONDS)) events.push(event);

  assert.deepEqual(kinds(events), ["kill fork"]);
});

test("a fast stomp straight down kills only the big fork bomb", () => {
  const world = createWorld(FORK_LEVEL);
  const fork = world.enemies[0];
  world.hero.x = fork.x;
  world.hero.y = fork.y - fork.height - 1;
  world.hero.vy = 700;
  world.hero.grounded = false;

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["kill fork"]);
});

test("a high bounce off a fork bomb on a platform does not come down on the small ones", () => {
  const world = createWorld(levelFrom(["@.........", ".....f....", "...======.", "..........", "##########"]));
  const fork = world.enemies[0];
  const holding = { direction: 0, jumpHeld: true, jumpPressed: false };
  dropHeroOnto(world, fork);

  const events = worldEventsUntil(world, holding, e => e.length > 0);
  for (let i = 0; i < 120; i++) for (const event of stepWorld(world, holding, STEP_SECONDS)) events.push(event);

  assert.deepEqual(kinds(events).filter(kind => kind === "kill fork"), ["kill fork"]);
});

test("a running stomp without holding jump does not land the hero on the small fork bombs", () => {
  const world = createWorld(FORK_LEVEL);
  const running = { direction: 1, jumpHeld: false, jumpPressed: false };
  const fork = world.enemies[0];
  dropHeroOnto(world, fork);
  world.hero.x = fork.x - 4;
  world.hero.y = fork.y - fork.height - 1;
  world.hero.vx = WALK_SPEED;

  const events = worldEventsUntil(world, running, e => e.length > 0);
  for (let i = 0; i < 30; i++) for (const event of stepWorld(world, running, STEP_SECONDS)) events.push(event);

  assert.deepEqual(kinds(events), ["kill fork"]);
});

test("a small fork bomb cannot be stomped before the hero has landed from the split", () => {
  const world = createWorld(FORK_LEVEL);
  const [fork, left] = world.enemies;
  dropHeroOnto(world, fork);
  worldEventsUntil(world, IDLE, e => e.length > 0);
  steps(world, 6);
  world.hero.x = left.x;
  world.hero.y = left.y - left.height - 1;
  world.hero.vy = 200;

  const events = [];
  for (let i = 0; i < 6; i++) for (const event of stepWorld(world, IDLE, STEP_SECONDS)) events.push(event);

  assert.deepEqual([kinds(events), left.alive], [[], true]);
});

test("right after the split the small fork bombs do not hurt", () => {
  const world = createWorld(FORK_LEVEL);
  const [fork, left] = world.enemies;
  dropHeroOnto(world, fork);
  worldEventsUntil(world, IDLE, e => e.length > 0);
  heroTouchingFromSide(world, left);
  world.hero.vy = 0;

  const events = [];
  for (let i = 0; i < Math.round((SPLIT_GRACE_SECONDS - 0.05) / STEP_SECONDS); i++) for (const event of stepWorld(world, IDLE, STEP_SECONDS)) events.push(event);

  assert.deepEqual(kinds(events), []);
});

test("small fork bombs bounce off walls", () => {
  const world = createWorld(FORK_LEVEL);
  const [fork, left, right] = world.enemies;
  dropHeroOnto(world, fork);
  worldEventsUntil(world, IDLE, e => e.length > 0);
  world.hero.x = 100 * TILE;

  for (let i = 0; i < 600; i++) stepEnemies(world.enemies, world.level, FAR_AWAY, STEP_SECONDS);

  assert.ok(left.x - left.width / 2 >= 2 * TILE - 0.01 && right.x + right.width / 2 <= 17 * TILE + 0.01);
});

test("a small fork bomb dies to one stomp and does not split", () => {
  const world = createWorld(FORK_LEVEL);
  const [fork, left] = world.enemies;
  dropHeroOnto(world, fork);
  worldEventsUntil(world, IDLE, e => e.length > 0);
  steps(world, 60);
  dropHeroOnto(world, left);
  world.hero.vy = 120;

  const events = worldEventsUntil(world, IDLE, e => e.some(event => event.source === "fork"));

  assert.deepEqual(events.filter(e => e.type === "kill").map(e => e.small), [true]);
  assert.equal(world.enemies.filter(enemy => enemy.alive).length, 1);
});

test("a big fork bomb scores forked and a small one scores wait() with fewer points", () => {
  const run = createRun(1, FORK_LEVEL);
  const [fork, left] = run.world.enemies;
  dropHeroOnto(run.world, fork);
  while (fork.alive) stepRun(run, IDLE, STEP_SECONDS);
  for (let i = 0; i < 60; i++) stepRun(run, IDLE, STEP_SECONDS);
  dropHeroOnto(run.world, left);
  run.world.hero.vy = 120;
  for (let i = 0; i < 60 && left.alive; i++) stepRun(run, IDLE, STEP_SECONDS);

  assert.equal(run.score, 150);
  assert.deepEqual(run.popups.map(p => p.note), ["forked", "wait()"]);
});

test("after a respawn the small fork bombs return to where they split and the big one stays dead", () => {
  const world = createWorld(FORK_LEVEL);
  const [fork, left] = world.enemies;
  dropHeroOnto(world, fork);
  worldEventsUntil(world, IDLE, e => e.length > 0);
  const splitAt = fork.x;
  steps(world, 60);

  respawnHero(world);

  assert.deepEqual([fork.alive, left.alive, left.x], [false, true, splitAt]);
});

const LEAK_LEVEL = levelFrom(["@.....~~~~~~~m...", "#################"]);
const LEAK_FULL = 7 * TILE;

function grownAfter(leak, seconds) {
  stepOnCamera([leak], LEAK_LEVEL, seconds, OFF_SCREEN);
  return leak.grown;
}

test("a memory leak's puddle starts growing only once it has been on screen", () => {
  const [offScreen] = enemiesOf(LEAK_LEVEL);
  const [leak] = enemiesOf(LEAK_LEVEL);

  stepOnCamera([offScreen], LEAK_LEVEL, 2, OFF_SCREEN);
  stepOnCamera([leak], LEAK_LEVEL, STEP_SECONDS, ON_SCREEN);

  assert.equal(offScreen.grown, 0);
  assert.ok(grownAfter(leak, 1) > 0);
});

test("a memory leak's puddle grows to its frame, stays, dries back to the source and grows again", () => {
  const [leak] = enemiesOf(LEAK_LEVEL);
  stepOnCamera([leak], LEAK_LEVEL, STEP_SECONDS, ON_SCREEN);
  const growSeconds = LEAK_FULL / LEAK_GROW_SPEED;
  const shrinkSeconds = LEAK_FULL / LEAK_SHRINK_SPEED;

  const growing = grownAfter(leak, 0.5);
  const full = grownAfter(leak, growSeconds - 0.5 + LEAK_FULL_SECONDS / 2);
  const shrinking = grownAfter(leak, LEAK_FULL_SECONDS / 2 + shrinkSeconds / 2);
  const empty = grownAfter(leak, shrinkSeconds / 2 + LEAK_EMPTY_SECONDS / 2);
  const again = grownAfter(leak, LEAK_EMPTY_SECONDS / 2 + 0.5);

  assert.ok(Math.abs(growing - LEAK_GROW_SPEED * 0.5) < 2);
  assert.equal(full, LEAK_FULL);
  assert.ok(Math.abs(shrinking - LEAK_FULL / 2) < 2);
  assert.equal(empty, 0);
  assert.ok(Math.abs(again - growing) < 2);
  assert.ok(Math.abs(leakCycleSeconds(7) - (growSeconds + LEAK_FULL_SECONDS + shrinkSeconds + LEAK_EMPTY_SECONDS)) < 1e-9);
});

test("touching the puddle is a hit, beyond its edge is not", () => {
  const [leak] = enemiesOf(LEAK_LEVEL);
  stepOnCamera([leak], LEAK_LEVEL, 1, ON_SCREEN);

  assert.equal(harmsHeroAt(leak, 12.5 * TILE, GROUND_Y), true);
  assert.equal(harmsHeroAt(leak, 8 * TILE, GROUND_Y), false);
});

test("stomping the leak's source frees it: the puddle goes and it scores free()", () => {
  const run = createRun(1, LEAK_LEVEL);
  const leak = run.world.enemies[0];
  stepOnCamera([leak], LEAK_LEVEL, 3, ON_SCREEN);
  dropHeroOnto(run.world, leak);

  for (let i = 0; i < 60; i++) stepRun(run, IDLE, STEP_SECONDS);

  assert.equal(leak.alive, false);
  assert.equal(harmsHeroAt(leak, 12.5 * TILE, GROUND_Y), false);
  assert.deepEqual([run.score, run.popups.map(p => p.note)], [200, ["free()"]]);
});

const SPINLOCK_LEVEL = levelFrom(["@.........s.........", "####################", "####################", "####################"]);
const SPINLOCK_GROUND = 19 * TILE;
const PIVOT_Y = SPINLOCK_GROUND - TILE / 2;

function spinlockAt(level, slot, seconds) {
  const [spinlock] = createEnemies(level.enemies.map(enemy => Object.assign({}, enemy, slot)));
  stepFor([spinlock], level, FAR_AWAY, seconds);
  return spinlock;
}

function tip(spinlock) {
  const link = spinlock.links[spinlock.links.length - 1];
  return [Math.round(link.x - spinlock.x), Math.round(link.y - PIVOT_Y)];
}

test("a spinlock's arm has one link per length, evenly spaced out from the pivot", () => {
  const spinlock = spinlockAt(SPINLOCK_LEVEL, { arm: 4, spin: 1, phase: 0 }, STEP_SECONDS);

  assert.equal(spinlock.links.length, 4);
  assert.deepEqual(tip(spinlock), [4 * SPINLOCK_SPACING, -1]);
});

test("a spinlock turns a full circle every period, its direction set by its spin", () => {
  const quarter = SPINLOCK_PERIOD / 4;

  assert.deepEqual(tip(spinlockAt(SPINLOCK_LEVEL, { arm: 3, spin: 1, phase: 0 }, quarter)), [0, -3 * SPINLOCK_SPACING]);
  assert.deepEqual(tip(spinlockAt(SPINLOCK_LEVEL, { arm: 3, spin: -1, phase: 0 }, quarter)), [0, 3 * SPINLOCK_SPACING]);
  assert.deepEqual(tip(spinlockAt(SPINLOCK_LEVEL, { arm: 3, spin: 1, phase: 0 }, SPINLOCK_PERIOD)), [3 * SPINLOCK_SPACING, 0]);
});

test("a double spinlock has a second arm pointing the opposite way", () => {
  const spinlock = spinlockAt(SPINLOCK_LEVEL, { arm: 3, spin: 1, phase: 0, double: true }, STEP_SECONDS);
  const ends = [spinlock.links[2], spinlock.links[5]].map(link => [Math.round(link.x - spinlock.x), Math.round(link.y - PIVOT_Y)]);

  assert.equal(spinlock.links.length, 6);
  assert.deepEqual(ends, [[3 * SPINLOCK_SPACING, -1], [-3 * SPINLOCK_SPACING, 1]]);
});

test("a spinlock's phase sets its starting angle", () => {
  const spinlock = spinlockAt(SPINLOCK_LEVEL, { arm: 3, spin: 1, phase: SPINLOCK_PERIOD / 2 }, STEP_SECONDS);

  assert.deepEqual(tip(spinlock), [-3 * SPINLOCK_SPACING, 1]);
});

test("links inside the ground are buried and the others are not", () => {
  const down = spinlockAt(SPINLOCK_LEVEL, { arm: 5, spin: -1, phase: 0 }, SPINLOCK_PERIOD / 4);
  const up = spinlockAt(SPINLOCK_LEVEL, { arm: 5, spin: 1, phase: 0 }, SPINLOCK_PERIOD / 4);

  assert.ok(down.links.every(link => link.buried));
  assert.ok(up.links.every(link => !link.buried));
});

test("a spinlock's arm hurts the hero it touches, away from the arm it does not", () => {
  const spinlock = spinlockAt(SPINLOCK_LEVEL, { arm: 5, spin: 1, phase: 0 }, STEP_SECONDS);
  const tipX = spinlock.links[4].x;

  assert.equal(harmsHeroAt(spinlock, tipX, SPINLOCK_GROUND), true);
  assert.equal(harmsHeroAt(spinlock, spinlock.x - 3 * TILE, SPINLOCK_GROUND), false);
});

test("the hero can stand on a spinlock's pivot while its arm is buried", () => {
  const world = createWorld(SPINLOCK_LEVEL);
  Object.assign(world.enemies[0], { arm: 3, spin: -1, phase: SPINLOCK_PERIOD / 4 });
  world.hero.x = world.enemies[0].x;
  world.hero.y = SPINLOCK_GROUND - 2 * TILE;
  world.hero.grounded = false;

  const events = worldEventsUntil(world, IDLE, () => world.hero.grounded);

  assert.deepEqual([world.hero.y, kinds(events)], [SPINLOCK_GROUND - TILE, []]);
});

test("a spinlock cannot be stomped", () => {
  const world = createWorld(SPINLOCK_LEVEL);
  Object.assign(world.enemies[0], { arm: 5, spin: 1, phase: SPINLOCK_PERIOD / 4 });
  world.hero.x = world.enemies[0].x;
  world.hero.y = SPINLOCK_GROUND - 6 * TILE;
  world.hero.vy = 120;
  world.hero.grounded = false;

  const events = worldEventsUntil(world, IDLE, e => e.length > 0);

  assert.deepEqual(kinds(events), ["hit spinlock"]);
});

test("a level map places a spinlock on its tile", () => {
  assert.deepEqual(SPINLOCK_LEVEL.enemies.map(e => [e.kind, e.col]), [["spinlock", 10]]);
});
