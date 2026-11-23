import { TILE, SCREEN_COLS, SCREEN_ROWS } from "./screen.mjs";
import { parseLevel } from "./level.mjs";
import { HERO_WIDTH, heroHeight } from "./physics.mjs";
import { createEnemy, stepEnemies, touchEnemies, STOMP_BOUNCE_VELOCITY, STOMP_TOLERANCE } from "./enemies.mjs";
import { subStream, pick, randomInt } from "./random.mjs";

export const PHASES = ["spikes+trace", "spikes+spawn", "trace+spawn"];
export const BOSS_HITS = 3;
export const BOSS_SPEEDS = [1, 1.2, 1.4];
export const INTRO_SECONDS = 2;
export const ATTACK_SECONDS = 6;
export const CORE_SECONDS = 3.5;
export const PAUSE_SECONDS = 1;
export const CRASH_SECONDS = 1.2;
export const REBOOT_SECONDS = 2;
export const DROP_TOP_ROW = 9;
export const DROP_WARNING_SECONDS = 0.85;
export const DROP_FALL_SPEED = 560;
export const SPIKE_SIZE = 14;
export const SPIKE_INTERVAL = 0.55;
export const TRACE_INTERVAL = 1.1;
export const TRACE_WARNING_SECONDS = 0.8;
export const TRACE_SPEED = 220;
export const TRACE_LENGTH = 4 * TILE;
export const TRACE_HEIGHT = 8;
export const TRACE_TEXTS = ["panic+0x5c", "do_exit+0x2a", "oops_end+0x9", "die+0x41", "schedule+0x3e", "page_fault+0x1e"];
export const SPAWN_INTERVAL = 1.5;
export const CORE_COLS = [5, 19, 33];
export const CORE_WIDTH = 2 * TILE;
export const CORE_HEIGHT = 16;
const ARENA_ROW = SCREEN_ROWS - 4;
const START_COL = 2;
const GROUND_ROWS = 3;
const DROP_MARGIN_COLS = 1;
const BUG_MARGIN_COLS = 3;

const EMITTED = { spikes: "spike", trace: "trace", spawn: "bug" };
const INTERVALS = { spike: SPIKE_INTERVAL, trace: TRACE_INTERVAL, bug: SPAWN_INTERVAL };

export function arenaLevel(seed) {
  const rows = [];
  for (let row = 0; row < SCREEN_ROWS - GROUND_ROWS; row++) rows.push(".".repeat(SCREEN_COLS));
  rows[ARENA_ROW] = ".".repeat(START_COL) + "@" + ".".repeat(SCREEN_COLS - START_COL - 1);
  for (let row = 0; row < GROUND_ROWS; row++) rows.push("#".repeat(SCREEN_COLS));
  const level = parseLevel(rows);
  level.arena = { col: 0, row: ARENA_ROW };
  level.seed = seed;
  return level;
}

export function phaseOrder(seed, count) {
  const random = subStream(seed, "boss-order");
  const order = [];
  while (order.length < count) {
    const previous = order[order.length - 1];
    order.push(pick(random, PHASES.filter(phase => phase !== previous)));
  }
  return order;
}

export function createBoss(seed, arena) {
  const left = arena.col * TILE;
  return {
    seed,
    left,
    right: left + SCREEN_COLS * TILE,
    ground: (arena.row + 1) * TILE,
    row: arena.row,
    random: subStream(seed, "boss-attacks"),
    state: "intro",
    timer: INTRO_SECONDS,
    hits: 0,
    attacks: 0,
    attack: null,
    drops: [],
    traces: [],
    bugs: [],
    core: null,
  };
}

export function bossSpeed(boss) {
  return BOSS_SPEEDS[Math.min(boss.hits, BOSS_SPEEDS.length - 1)];
}

function startAttack(boss) {
  const phase = phaseOrder(boss.seed, boss.attacks + 1)[boss.attacks];
  boss.attacks++;
  boss.state = "attack";
  boss.attack = {
    phase,
    time: 0,
    traceDirection: boss.random.next() < 0.5 ? -1 : 1,
    aimed: false,
    emitters: phase.split("+").map(pattern => ({ what: EMITTED[pattern], interval: INTERVALS[EMITTED[pattern]], next: 0 })),
  };
}

function randomCol(boss, margin) {
  return randomInt(boss.random, margin, SCREEN_COLS - margin - 1);
}

function spikeCol(boss, hero) {
  const aimed = boss.attack.aimed;
  boss.attack.aimed = !aimed;
  if (!aimed) return randomCol(boss, DROP_MARGIN_COLS);
  const col = Math.floor((hero.x - boss.left) / TILE);
  return Math.min(Math.max(col, DROP_MARGIN_COLS), SCREEN_COLS - DROP_MARGIN_COLS - 1);
}

function emit(boss, what, hero) {
  if (what === "trace") {
    const direction = boss.attack.traceDirection;
    boss.traces.push({
      x: direction < 0 ? boss.right - TRACE_LENGTH : boss.left,
      direction,
      row: randomInt(boss.random, 1, 2),
      text: pick(boss.random, TRACE_TEXTS),
      warning: TRACE_WARNING_SECONDS,
    });
    return;
  }
  const col = what === "bug" ? randomCol(boss, BUG_MARGIN_COLS) : spikeCol(boss, hero);
  boss.drops.push({ kind: what, x: boss.left + (col + 0.5) * TILE, y: DROP_TOP_ROW * TILE, warning: DROP_WARNING_SECONDS });
}

function runAttack(boss, hero, fast) {
  const attack = boss.attack;
  for (const emitter of attack.emitters) {
    while (emitter.next <= attack.time && emitter.next < ATTACK_SECONDS) {
      emit(boss, emitter.what, hero);
      emitter.next += emitter.interval;
    }
  }
  attack.time += fast;
  if (attack.time >= ATTACK_SECONDS && boss.drops.length === 0 && boss.traces.length === 0) {
    boss.state = "core";
    boss.attack = null;
    const col = pick(boss.random, CORE_COLS);
    boss.core = { x: boss.left + col * TILE + CORE_WIDTH / 2, timer: CORE_SECONDS };
  }
}

function landBug(boss, drop, hero) {
  const bug = createEnemy({ kind: "bug", col: Math.floor(drop.x / TILE), row: boss.row });
  bug.direction = hero.x < bug.x ? -1 : 1;
  boss.bugs.push(bug);
}

function moveDrops(boss, hero, fast) {
  const falling = [];
  for (const drop of boss.drops) {
    if (drop.warning > 0) drop.warning = Math.max(drop.warning - fast, 0);
    else drop.y += DROP_FALL_SPEED * fast;
    if (drop.y < boss.ground) falling.push(drop);
    else if (drop.kind === "bug") landBug(boss, drop, hero);
  }
  boss.drops = falling;
}

function moveTraces(boss, fast) {
  for (const trace of boss.traces) {
    if (trace.warning > 0) trace.warning = Math.max(trace.warning - fast, 0);
    else trace.x += trace.direction * TRACE_SPEED * fast;
  }
  boss.traces = boss.traces.filter(trace => trace.x + TRACE_LENGTH > boss.left && trace.x < boss.right);
}

function overlaps(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function heroBox(hero) {
  return { left: hero.x - HERO_WIDTH / 2, right: hero.x + HERO_WIDTH / 2, top: hero.y - heroHeight(hero), bottom: hero.y };
}

export function dropBox(drop) {
  return { left: drop.x - SPIKE_SIZE / 2, right: drop.x + SPIKE_SIZE / 2, top: drop.y - SPIKE_SIZE, bottom: drop.y };
}

export function traceBox(boss, trace) {
  const center = boss.ground - (trace.row - 0.5) * TILE;
  return { left: trace.x, right: trace.x + TRACE_LENGTH, top: center - TRACE_HEIGHT / 2, bottom: center + TRACE_HEIGHT / 2 };
}

export function coreBox(boss) {
  return { left: boss.core.x - CORE_WIDTH / 2, right: boss.core.x + CORE_WIDTH / 2, top: boss.ground - CORE_HEIGHT, bottom: boss.ground };
}

function hazardHits(boss, hero) {
  const area = heroBox(hero);
  const events = [];
  for (const drop of boss.drops) {
    if (drop.warning === 0 && overlaps(area, dropBox(drop))) events.push({ type: "hit", source: drop.kind === "bug" ? "bug" : "spikes" });
  }
  for (const trace of boss.traces) {
    if (trace.warning === 0 && overlaps(area, traceBox(boss, trace))) events.push({ type: "hit", source: "trace" });
  }
  return events;
}

function stepBugs(boss, level, hero, previousBottom, seconds) {
  stepEnemies(boss.bugs, level, hero, seconds);
  for (const bug of boss.bugs) {
    if (bug.x - bug.width / 2 < boss.left) {
      bug.x = boss.left + bug.width / 2;
      bug.direction = 1;
    }
  }
  const events = touchEnemies(boss.bugs, hero, previousBottom);
  boss.bugs = boss.bugs.filter(bug => bug.alive);
  return events;
}

function clearHazards(boss) {
  boss.drops = [];
  boss.traces = [];
  boss.bugs = [];
}

function pause(boss) {
  boss.core = null;
  boss.bugs = [];
  boss.state = "pause";
  boss.timer = PAUSE_SECONDS;
}

function stompsCore(boss, hero, previousBottom) {
  const box = coreBox(boss);
  return overlaps(heroBox(hero), box) && previousBottom <= box.top + STOMP_TOLERANCE;
}

function hitCore(boss, hero, events) {
  hero.vy = -STOMP_BOUNCE_VELOCITY;
  hero.jumping = true;
  hero.grounded = false;
  boss.hits++;
  events.push({ type: "bossHit", hits: boss.hits, x: boss.core.x, y: boss.ground - CORE_HEIGHT });
  if (boss.hits < BOSS_HITS) {
    pause(boss);
    return;
  }
  boss.core = null;
  clearHazards(boss);
  boss.state = "crash";
  boss.timer = CRASH_SECONDS;
}

function runTimers(boss, seconds, events) {
  boss.timer = Math.max(boss.timer - seconds, 0);
  if (boss.timer > 0) return;
  if (boss.state === "intro" || boss.state === "pause") startAttack(boss);
  else if (boss.state === "crash") {
    boss.state = "reboot";
    boss.timer = REBOOT_SECONDS;
    events.push({ type: "bossDefeated" });
  } else if (boss.state === "reboot") {
    boss.state = "done";
    events.push({ type: "rebooted" });
  }
}

export function stepBoss(boss, level, hero, previousBottom, seconds) {
  const events = [];
  const fast = seconds * bossSpeed(boss);
  if (boss.state === "attack") runAttack(boss, hero, fast);
  else if (boss.state === "core") {
    boss.core.timer = Math.max(boss.core.timer - seconds, 0);
    if (stompsCore(boss, hero, previousBottom)) hitCore(boss, hero, events);
    else if (boss.core.timer === 0) pause(boss);
  } else if (boss.state !== "done") runTimers(boss, seconds, events);
  moveDrops(boss, hero, fast);
  moveTraces(boss, fast);
  return events.concat(stepBugs(boss, level, hero, previousBottom, seconds), hazardHits(boss, hero));
}
