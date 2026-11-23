import { test } from "node:test";
import assert from "node:assert/strict";
import {
  arenaLevel,
  createBoss,
  coreBox,
  phaseOrder,
  resumeBoss,
  stepBoss,
  BOSS_HITS,
  CORE_HEIGHT,
  CORE_SECONDS,
  DROP_TOP_ROW,
  INTRO_SECONDS,
  MAX_BUGS,
  MAX_DROPS,
  MAX_TRACES,
  PHASES,
  PAUSE_SECONDS,
  PHASE_SECONDS,
  TRACE_LENGTH,
} from "../logic/boss.mjs";
import { createHero } from "../logic/physics.mjs";
import { STEP_SECONDS } from "../logic/clock.mjs";
import { SCREEN_COLS, TILE } from "../logic/screen.mjs";

const SEED = 0x7f3a91c2;
const SEEDS = Array.from({ length: 200 }, (_, i) => Math.imul(i + 1, 0x9e3779b1) >>> 0);
const LEVEL = arenaLevel(SEED);
const GROUND = (LEVEL.arena.row + 1) * TILE;

function fight(seed) {
  return { boss: createBoss(seed || SEED, LEVEL.arena), hero: createHero(1.5 * TILE, GROUND) };
}

function step(f, previousBottom) {
  return stepBoss(f.boss, LEVEL, f.hero, previousBottom === undefined ? f.hero.y : previousBottom, STEP_SECONDS);
}

function stepUntil(f, done) {
  const events = [];
  let seconds = 0;
  for (let i = 0; i < 100000 && !done(f.boss); i++) {
    for (const event of step(f)) events.push(event);
    seconds += STEP_SECONDS;
  }
  return { events, seconds };
}

function stompCore(f) {
  const box = coreBox(f.boss);
  f.hero.x = (box.left + box.right) / 2;
  f.hero.y = GROUND - CORE_HEIGHT + 2;
  return step(f, GROUND - CORE_HEIGHT - 1);
}

function reachCore(f) {
  return stepUntil(f, boss => boss.state === "core");
}

function hitsFrom(events, source) {
  return events.filter(event => event.type === "hit" && event.source === source);
}

function phaseWith(pattern) {
  for (const seed of SEEDS) {
    if (phaseOrder(seed, 1)[0].split("+").includes(pattern)) {
      const f = fight(seed);
      stepUntil(f, boss => boss.state === "attack");
      step(f);
      return f;
    }
  }
  throw new Error("no seed starts with " + pattern);
}

test("the arena is one screen of flat ground with the hero at its left", () => {
  assert.equal(LEVEL.cols, SCREEN_COLS);
  assert.deepEqual([LEVEL.start.col < 4, LEVEL.exit, LEVEL.checkpoint, LEVEL.enemies, LEVEL.seed], [true, null, null, [], SEED]);
  assert.ok(LEVEL.rows[LEVEL.arena.row + 1].split("").every(tile => tile === "#"));
});

test("the same seed always gives the same phase order", () => {
  assert.deepEqual(phaseOrder(SEED, 50), phaseOrder(SEED, 50));
  assert.notDeepEqual(phaseOrder(1, 50), phaseOrder(2, 50));
});

test("a longer order starts with the shorter one", () => {
  assert.deepEqual(phaseOrder(SEED, 60).slice(0, 20), phaseOrder(SEED, 20));
});

test("every phase combines two different attack patterns", () => {
  for (const phase of PHASES) {
    const patterns = phase.split("+");
    assert.equal(patterns.length, 2);
    assert.notEqual(patterns[0], patterns[1]);
  }
});

test("no phase comes twice in a row, and every phase comes up", () => {
  for (const seed of SEEDS) {
    const order = phaseOrder(seed, 100);
    for (let i = 1; i < order.length; i++) assert.notEqual(order[i], order[i - 1], "seed " + seed);
    for (const phase of PHASES) assert.ok(order.includes(phase));
  }
});

test("the boss waits for its intro, then attacks in the seed's order", () => {
  const f = fight();

  const { seconds } = stepUntil(f, boss => boss.state === "attack");
  const first = f.boss.attack.phase;
  reachCore(f);
  stepUntil(f, boss => boss.state === "attack");

  assert.ok(Math.abs(seconds - INTRO_SECONDS) < 2 * STEP_SECONDS);
  assert.deepEqual([first, f.boss.attack.phase], phaseOrder(SEED, 2));
});

test("a phase runs both of its patterns at once", () => {
  for (const phase of PHASES) {
    const seed = SEEDS.filter(candidate => phaseOrder(candidate, 1)[0] === phase)[0];
    const f = fight(seed);
    const seen = {};
    stepUntil(f, boss => {
      for (const drop of boss.drops) seen[drop.kind === "bug" ? "spawn" : "spikes"] = true;
      if (boss.traces.length > 0) seen.trace = true;
      return boss.state === "core";
    });

    assert.deepEqual(Object.keys(seen).sort(), phase.split("+").sort(), phase);
  }
});

test("after an attack the core stays out for its window, and a missed window leads to the next attack", () => {
  const f = fight();
  reachCore(f);

  const out = stepUntil(f, boss => boss.state !== "core").seconds;
  const paused = stepUntil(f, boss => boss.state !== "pause").seconds;

  assert.ok(Math.abs(out - CORE_SECONDS) < 2 * STEP_SECONDS);
  assert.ok(Math.abs(paused - PAUSE_SECONDS) < 2 * STEP_SECONDS);
  assert.deepEqual([f.boss.state, f.boss.hits, f.boss.attacks], ["attack", 0, 2]);
});

test("stomping the core counts a hit and bounces the hero", () => {
  const f = fight();
  reachCore(f);

  const events = stompCore(f);

  assert.equal(f.boss.hits, 1);
  assert.ok(f.hero.vy < 0);
  assert.deepEqual(events.filter(event => event.type === "bossHit").map(event => event.hits), [1]);
  assert.equal(f.boss.core, null);
});

test("touching the core from the side does nothing", () => {
  const f = fight();
  reachCore(f);
  const box = coreBox(f.boss);
  f.hero.x = box.left;
  f.hero.y = GROUND;

  step(f);

  assert.deepEqual([f.boss.hits, f.boss.state], [0, "core"]);
});

test("each hit speeds the attacks up", () => {
  const firstRepeats = [0, 1, 2].map(hits => {
    const f = fight();
    f.boss.hits = hits;
    stepUntil(f, boss => boss.state === "attack");
    return stepUntil(f, boss => boss.drops.length + boss.traces.length >= 3).seconds;
  });

  assert.ok(firstRepeats[1] < firstRepeats[0] && firstRepeats[2] < firstRepeats[1], firstRepeats.join(", "));
});

test("each hit makes the phases longer: 10, 15 and 20 seconds of attacks", () => {
  const emitting = [0, 1, 2].map(hits => {
    const f = fight();
    f.boss.hits = hits;
    stepUntil(f, boss => boss.state === "attack");
    let last = 0;
    let seconds = 0;
    let count = 0;
    stepUntil(f, boss => {
      seconds += STEP_SECONDS;
      const now = boss.drops.length + boss.traces.length;
      if (now > count) last = seconds;
      count = now;
      return boss.state === "core";
    });
    return last;
  });

  emitting.forEach((seconds, hits) => {
    const expected = PHASE_SECONDS[hits];
    assert.ok(seconds > expected - 2.1 && seconds <= expected, hits + " hits: " + seconds);
  });
});

test("the third hit crashes the boss, reports its defeat and then reboots", () => {
  const f = fight();
  for (let hit = 0; hit < BOSS_HITS; hit++) {
    reachCore(f);
    stompCore(f);
  }

  const { events } = stepUntil(f, boss => boss.state === "done");

  assert.deepEqual(events.filter(event => event.type !== "hit" && event.type !== "kill").map(event => event.type), ["bossDefeated", "rebooted"]);
  assert.deepEqual([f.boss.drops, f.boss.traces, f.boss.bugs], [[], [], []]);
});

test("a falling spike is marked before it drops and hurts only once falling", () => {
  const f = phaseWith("spikes");
  const drop = f.boss.drops.filter(candidate => candidate.kind === "spike")[0];
  f.hero.x = drop.x;
  f.hero.y = DROP_TOP_ROW * TILE + 4;

  const warned = hitsFrom(step(f), "spikes");
  stepUntil(f, () => drop.warning === 0);
  f.hero.y = drop.y + 10;
  const falling = hitsFrom(step(f), "spikes");

  assert.deepEqual(warned, []);
  assert.equal(falling.length, 1);
});

test("spikes aim at the hero every other time", () => {
  const f = phaseWith("spikes");
  f.hero.x = 20.5 * TILE;
  const emitted = f.boss.drops.filter(drop => drop.kind === "spike");

  for (let i = 0; i < 1000 && emitted.length < 4; i++) {
    step(f);
    for (const drop of f.boss.drops) if (drop.kind === "spike" && !emitted.includes(drop)) emitted.push(drop);
  }

  assert.deepEqual([emitted[1].x, emitted[3].x], [f.hero.x, f.hero.x]);
});

test("a stack trace line is faint and harmless first, then sweeps across the arena", () => {
  const f = phaseWith("trace");
  const trace = f.boss.traces[0];
  const startX = trace.x;
  f.hero.x = trace.x + TRACE_LENGTH / 2;
  f.hero.big = true;

  const warned = hitsFrom(step(f), "trace");
  stepUntil(f, () => trace.warning === 0);
  const hit = hitsFrom(step(f), "trace");

  assert.deepEqual(warned, []);
  assert.equal(hit.length, 1);
  assert.ok(trace.x !== startX);
});

test("a low stack trace line hits a standing hero and a high one passes over the small hero", () => {
  const sources = { 1: null, 2: null };
  const f = phaseWith("trace");
  f.hero.y = GROUND;
  for (let i = 0; i < 4000 && (sources[1] === null || sources[2] === null); i++) {
    const trace = f.boss.traces.filter(t => t.warning === 0)[0];
    if (trace) f.hero.x = trace.x + TRACE_LENGTH / 2;
    const hits = hitsFrom(step(f), "trace");
    if (trace && sources[trace.row] === null) sources[trace.row] = hits.length;
  }

  assert.deepEqual([sources[1], sources[2]], [1, 0]);
});

test("stack trace lines within one phase all come from the same side", () => {
  const f = phaseWith("trace");
  const directions = {};

  stepUntil(f, boss => {
    for (const trace of boss.traces) directions[trace.direction] = true;
    return boss.state === "core";
  });

  assert.equal(Object.keys(directions).length, 1);
});

test("spawned bugs drop in, walk and can be stomped, and are gone after the core window", () => {
  const f = phaseWith("spawn");
  f.hero.x = 1.5 * TILE;

  stepUntil(f, boss => boss.bugs.length > 0);
  const bug = f.boss.bugs[0];
  const landedX = bug.x;
  step(f);
  const walked = bug.x !== landedX;
  f.hero.x = bug.x;
  f.hero.y = bug.y - bug.height + 4;
  const kills = step(f, bug.y - bug.height - 1).filter(event => event.type === "kill");
  reachCore(f);
  stepUntil(f, boss => boss.state === "attack");

  assert.ok(walked);
  assert.deepEqual(kills.map(event => event.source), ["bug"]);
  assert.deepEqual(f.boss.bugs, []);
});

function mostHazardsInLastPhase(seed) {
  const f = fight(seed);
  reachCore(f);
  stompCore(f);
  reachCore(f);
  stompCore(f);
  const most = { drops: 0, traces: 0, bugs: 0 };
  for (let i = 0; i < 100000 && f.boss.state !== "core"; i++) {
    f.hero.y = GROUND - 10 * TILE;
    f.hero.vy = 0;
    step(f);
    for (const kind of Object.keys(most)) most[kind] = Math.max(most[kind], f.boss[kind].length);
  }
  return most;
}

test("the longest, fastest phases never hold more hazards than the arena can draw", () => {
  for (const seed of SEEDS.slice(0, 30)) {
    const most = mostHazardsInLastPhase(seed);

    assert.ok(most.drops <= MAX_DROPS, "drops " + most.drops);
    assert.ok(most.traces <= MAX_TRACES, "traces " + most.traces);
    assert.ok(most.bugs <= MAX_BUGS, "bugs " + most.bugs);
  }
});

function phaseStarted(f) {
  return stepUntil(f, boss => boss.state === "attack").events;
}

test("after a death in a phase, the boss keeps its hits and runs that phase again from its start", () => {
  const f = fight();
  reachCore(f);
  stompCore(f);
  reachCore(f);
  stompCore(f);
  phaseStarted(f);
  stepUntil(f, boss => boss.attack.time > 3);
  const phase = f.boss.attack.phase;

  resumeBoss(f.boss);
  const intro = [f.boss.state, f.boss.drops.length, f.boss.traces.length, f.boss.bugs.length];
  const { seconds } = stepUntil(f, boss => boss.state === "attack");

  assert.deepEqual(intro, ["intro", 0, 0, 0]);
  assert.ok(Math.abs(seconds - INTRO_SECONDS) < 0.02);
  assert.deepEqual([f.boss.hits, f.boss.attacks, f.boss.attack.phase, f.boss.attack.time], [2, 3, phase, 0]);
});

test("after a death during a core window, the boss runs the same phase again", () => {
  const f = fight();
  reachCore(f);

  resumeBoss(f.boss);
  stepUntil(f, boss => boss.state === "attack");

  assert.deepEqual([f.boss.core, f.boss.hits, f.boss.attacks, f.boss.attack.phase], [null, 0, 1, phaseOrder(SEED, 1)[0]]);
});

test("after a death in the pause following a missed core, the boss runs the missed phase again", () => {
  const f = fight();
  reachCore(f);
  stepUntil(f, boss => boss.state === "pause");

  resumeBoss(f.boss);
  stepUntil(f, boss => boss.state === "attack");

  assert.deepEqual([f.boss.hits, f.boss.attacks], [0, 1]);
});

test("after a death in the pause following a hit, the boss goes on with the next phase", () => {
  const f = fight();
  reachCore(f);
  stompCore(f);

  resumeBoss(f.boss);
  stepUntil(f, boss => boss.state === "attack");

  assert.deepEqual([f.boss.hits, f.boss.attacks, f.boss.attack.phase], [1, 2, phaseOrder(SEED, 2)[1]]);
});

test("dying again before the resumed phase starts does not go back further", () => {
  const f = fight();
  reachCore(f);
  stompCore(f);
  reachCore(f);
  resumeBoss(f.boss);

  resumeBoss(f.boss);
  stepUntil(f, boss => boss.state === "attack");

  assert.deepEqual([f.boss.hits, f.boss.attacks], [1, 2]);
});

test("a resumed fight keeps the seed's phase order", () => {
  const f = fight();
  const order = phaseOrder(SEED, 2);
  const phases = [];
  for (let i = 0; i < 4; i++) {
    phaseStarted(f);
    phases.push(f.boss.attack.phase);
    if (i % 2 === 0) resumeBoss(f.boss);
    else reachCore(f);
  }

  assert.deepEqual(phases, [order[0], order[0], order[1], order[1]]);
});
