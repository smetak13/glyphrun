import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  hitHero,
  killEnemy,
  levelSummary,
  nextLevel,
  runBits,
  runSeconds,
  stepRun,
  DEATH_SECONDS,
  INVULNERABLE_SECONDS,
  LEVEL_COUNT,
  LIVES,
  POPUP_SECONDS,
  TOAST_SECONDS,
} from "../logic/run.mjs";
import { parseLevel } from "../logic/level.mjs";
import { STEP_SECONDS } from "../logic/clock.mjs";
import { TILE } from "../logic/screen.mjs";
import { BOSS_DEFEATED_POINTS, BOSS_HIT_POINTS, PAR_SECONDS, TIME_BONUS_PER_SECOND } from "../logic/score.mjs";
import { arenaLevel, coreBox } from "../logic/boss.mjs";

const IDLE = { direction: 0, jumpHeld: false, jumpPressed: false };
const RIGHT = { direction: 1, jumpHeld: false, jumpPressed: false };

function levelFrom(bottomRows) {
  const cols = bottomRows[0].length;
  const rows = [];
  for (let i = 0; i < 22 - bottomRows.length; i++) rows.push(".".repeat(cols));
  return parseLevel(rows.concat(bottomRows));
}

const FLAT = levelFrom([".@........", "##########"]);
const PIT = levelFrom([".@........C..", "####.....####"]);
const PIT_AFTER_CHECKPOINT = levelFrom([".@C..........", "#####...#####"]);
const BITS = levelFrom([".@.0.1......", "############"]);
const SUDO = levelFrom([".@.S........", "############"]);
const EXIT = levelFrom([".@...X......", "############"]);

function steps(run, input, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) stepRun(run, input, STEP_SECONDS);
}

function stepUntil(run, input, done) {
  for (let i = 0; i < 10000 && !done(run); i++) stepRun(run, input, STEP_SECONDS);
}

function fallIntoPit(run) {
  stepUntil(run, RIGHT, r => r.dying > 0);
  steps(run, IDLE, DEATH_SECONDS + 0.1);
}

function bigRun(level) {
  const run = createRun(1, level);
  run.world.hero.big = true;
  return run;
}

test("a run starts on level 1 with three lives, no score and a small hero", () => {
  const run = createRun(0x7f3a91c2, FLAT);

  assert.deepEqual([run.levelNumber, run.lives, run.score, run.world.hero.big, run.over], [1, LIVES, 0, false, false]);
});

test("falling into a pit costs a life and shows its message", () => {
  const run = createRun(1, PIT);

  stepUntil(run, RIGHT, r => r.dying > 0);

  assert.equal(run.lives, LIVES - 1);
  assert.equal(run.toast.text, "/dev/null: write successful");
});

test("after a pit the hero respawns at the start once the death beat is over", () => {
  const run = createRun(1, PIT);
  stepUntil(run, RIGHT, r => r.dying > 0);

  steps(run, IDLE, DEATH_SECONDS - 0.1);
  const during = run.world.hero.y;
  steps(run, IDLE, 0.2);

  assert.ok(during > 22 * TILE);
  assert.deepEqual([run.world.hero.x, run.world.hero.y, run.dying], [1.5 * TILE, 21 * TILE, 0]);
});

test("after the checkpoint the hero respawns at the checkpoint", () => {
  const run = createRun(1, PIT_AFTER_CHECKPOINT);

  fallIntoPit(run);

  assert.deepEqual([run.world.hero.x, run.world.hero.y], [2.5 * TILE, 21 * TILE]);
});

test("passing the checkpoint says snapshot saved", () => {
  const run = createRun(1, PIT_AFTER_CHECKPOINT);

  stepUntil(run, RIGHT, r => r.world.checkpointReached);

  assert.equal(run.toast.text, "snapshot saved");
});

test("a pit costs a life even while big, and the hero respawns small", () => {
  const run = bigRun(PIT);

  fallIntoPit(run);

  assert.deepEqual([run.lives, run.world.hero.big], [LIVES - 1, false]);
});

test("the last life shows no toast and keeps its cause for the game over screen", () => {
  const run = createRun(1, FLAT);
  run.lives = 1;

  hitHero(run, "ping");

  assert.deepEqual([run.toast, run.cause], [null, "request timed out"]);
});

test("losing the last life ends the run after the death beat", () => {
  const run = createRun(1, PIT);
  fallIntoPit(run);
  fallIntoPit(run);
  stepUntil(run, RIGHT, r => r.dying > 0);

  const overAtOnce = run.over;
  steps(run, IDLE, DEATH_SECONDS + 0.1);

  assert.deepEqual([run.lives, overAtOnce, run.over], [0, false, true]);
});

test("a hit while small costs a life and names the source", () => {
  const run = createRun(1, FLAT);

  hitHero(run, "bug");

  assert.deepEqual([run.lives, run.dying, run.toast.text], [LIVES - 1, DEATH_SECONDS, "unhandled exception"]);
});

test("a hit while big shrinks the hero and makes it invulnerable instead of costing a life", () => {
  const run = bigRun(FLAT);

  hitHero(run, "zombie");

  assert.deepEqual([run.lives, run.world.hero.big, run.invulnerable], [LIVES, false, INVULNERABLE_SECONDS]);
  assert.equal(run.toast.text, "<defunct> process attached");
});

test("hits are ignored while invulnerable", () => {
  const run = bigRun(FLAT);
  hitHero(run, "bug");

  steps(run, IDLE, INVULNERABLE_SECONDS - 0.1);
  hitHero(run, "bug");

  assert.equal(run.lives, LIVES);
});

test("invulnerability wears off", () => {
  const run = bigRun(FLAT);
  hitHero(run, "bug");

  steps(run, IDLE, INVULNERABLE_SECONDS + 0.1);
  hitHero(run, "bug");

  assert.equal(run.lives, LIVES - 1);
});

test("a hit during the death beat does not cost another life", () => {
  const run = createRun(1, FLAT);
  hitHero(run, "bug");

  hitHero(run, "bug");

  assert.equal(run.lives, LIVES - 1);
});

test("the sudo bit grows a small hero and scores 250", () => {
  const run = createRun(1, SUDO);

  stepUntil(run, RIGHT, r => r.world.bits[0].collected);

  assert.deepEqual([run.world.hero.big, run.score, run.toast.text], [true, 250, "sudo: privileges granted"]);
});

test("the sudo bit while already big scores 500 and says already root", () => {
  const run = bigRun(SUDO);

  stepUntil(run, RIGHT, r => r.world.bits[0].collected);

  assert.deepEqual([run.world.hero.big, run.score, run.toast.text], [true, 500, "already root"]);
});

test("each bit scores 10 with a popup where it was", () => {
  const run = createRun(1, BITS);

  stepUntil(run, RIGHT, r => r.world.bits[1].collected);

  assert.deepEqual([run.score, runBits(run)], [20, 2]);
  assert.deepEqual(run.popups.map(p => [p.x, p.text]), [[3.5 * TILE, "+10"], [5.5 * TILE, "+10"]]);
});

test("popups and toasts fade away", () => {
  const run = createRun(1, SUDO);
  stepUntil(run, RIGHT, r => r.world.bits[0].collected);

  steps(run, IDLE, POPUP_SECONDS + 0.1);
  const popups = run.popups.length;
  steps(run, IDLE, TOAST_SECONDS);

  assert.deepEqual([popups, run.toast], [0, null]);
});

test("a kill scores and shows its kill message under the score", () => {
  const run = createRun(1, FLAT);

  killEnemy(run, "ping", 100, 200, false);

  assert.equal(run.score, 100);
  assert.deepEqual(run.popups.map(p => [p.x, p.y, p.text, p.note]), [[100, 200, "+100", "pong"]]);
});

test("a small fork bomb scores 50 and a memory leak 200", () => {
  const run = createRun(1, FLAT);

  killEnemy(run, "fork", 0, 0, true);
  killEnemy(run, "leak", 0, 0, false);

  assert.equal(run.score, 250);
  assert.deepEqual(run.popups.map(p => p.note), ["wait()", "free()"]);
});

test("reaching the exit adds the time bonus for every whole second under par", () => {
  const run = createRun(1, EXIT);

  stepUntil(run, RIGHT, r => r.world.finished);

  const expected = Math.floor(PAR_SECONDS - run.world.time) * TIME_BONUS_PER_SECOND;
  assert.deepEqual([run.timeBonus, run.score], [expected, expected]);
});

test("the next level keeps lives, score, bits and sudo", () => {
  const run = createRun(1, SUDO);
  stepUntil(run, RIGHT, r => r.world.bits[0].collected);
  hitHero(run, "bug");
  steps(run, IDLE, INVULNERABLE_SECONDS + 0.1);
  run.world.hero.big = true;
  const score = run.score;

  nextLevel(run, BITS);
  stepUntil(run, RIGHT, r => r.world.bits[0].collected);

  assert.deepEqual([run.levelNumber, run.lives, run.world.hero.big, run.score, runBits(run)], [2, LIVES, true, score + 10, 1]);
});

test("sudo is gone in the next level once it was lost", () => {
  const run = createRun(1, SUDO);
  stepUntil(run, RIGHT, r => r.world.bits[0].collected);
  hitHero(run, "bug");

  nextLevel(run, FLAT);

  assert.equal(run.world.hero.big, false);
});

function bossRun() {
  const run = createRun(1, FLAT);
  run.levelNumber = LEVEL_COUNT;
  nextLevel(run, arenaLevel(1));
  run.invulnerable = 1000;
  return run;
}

function stompCore(run) {
  stepUntil(run, IDLE, r => r.world.boss.state === "core");
  const hero = run.world.hero;
  const box = coreBox(run.world.boss);
  hero.x = (box.left + box.right) / 2;
  hero.y = box.top - 0.5;
  hero.vy = 300;
  hero.grounded = false;
  stepRun(run, IDLE, STEP_SECONDS);
}

test("stomping the boss's core scores and says how many cores were dumped", () => {
  const run = bossRun();

  stompCore(run);

  assert.deepEqual([run.score, run.toast.text], [BOSS_HIT_POINTS, "core dumped (1/3)"]);
});

test("the third hit defeats the boss, says the kernel is rebooting and finishes the stage without a time bonus", () => {
  const run = bossRun();
  stompCore(run);
  stompCore(run);
  stompCore(run);

  stepUntil(run, IDLE, r => r.toast.text !== "core dumped (3/3)");
  const toast = run.toast.text;
  stepUntil(run, IDLE, r => r.world.finished);

  assert.equal(toast, "kernel: rebooting…");
  assert.equal(run.score, 3 * BOSS_HIT_POINTS + BOSS_DEFEATED_POINTS);
  assert.equal(run.world.finished, true);
});

test("a run is won only when the boss is defeated", () => {
  const run = bossRun();
  stompCore(run);
  stompCore(run);
  const before = run.won;
  stompCore(run);

  stepUntil(run, IDLE, r => r.world.finished);

  assert.deepEqual([before, run.won], [false, true]);
});

test("the run counts kills, reaped zombies, hits and deaths", () => {
  const run = createRun(1, PIT);
  killEnemy(run, "zombie", 0, 0, false);
  killEnemy(run, "bug", 0, 0, false);
  run.world.hero.big = true;
  hitHero(run, "bug");

  fallIntoPit(run);

  assert.deepEqual(run.stats, { kills: 2, zombies: 1, hits: 2, deaths: 1, seconds: 0 });
});

test("the run's time adds up the levels played", () => {
  const run = createRun(1, FLAT);
  steps(run, IDLE, 2);

  nextLevel(run, FLAT);
  steps(run, IDLE, 1);

  assert.ok(Math.abs(runSeconds(run) - 3) < 0.01);
});

test("the level summary breaks this level's score into bits, kills, sudo and time", () => {
  const run = createRun(1, BITS);
  stepUntil(run, RIGHT, r => r.world.bits[1].collected);
  killEnemy(run, "leak", 0, 0, false);
  killEnemy(run, "bug", 0, 0, false);
  run.world.time = 48.24;
  run.timeBonus = 220;

  const rows = levelSummary(run);

  assert.deepEqual(rows, [
    { label: "bits", detail: "2 × 10", points: 20 },
    { label: "kills", detail: "2", points: 300 },
    { label: "sudo", detail: "—", points: 0 },
    { label: "time", detail: "48.2 s", points: 220 },
  ]);
});

test("the level summary shows sudo as granted or already root", () => {
  const granted = createRun(1, SUDO);
  const root = bigRun(SUDO);

  stepUntil(granted, RIGHT, r => r.world.bits[0].collected);
  stepUntil(root, RIGHT, r => r.world.bits[0].collected);

  assert.deepEqual(levelSummary(granted)[2], { label: "sudo", detail: "granted", points: 250 });
  assert.deepEqual(levelSummary(root)[2], { label: "sudo", detail: "already root", points: 500 });
});

test("the level summary starts afresh on the next level", () => {
  const run = createRun(1, FLAT);
  killEnemy(run, "bug", 0, 0, false);

  nextLevel(run, FLAT);

  assert.deepEqual(levelSummary(run)[1], { label: "kills", detail: "0", points: 0 });
});
