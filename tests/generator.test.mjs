import { test } from "node:test";
import assert from "node:assert/strict";
import { ADVANCED_KINDS, BASIC_KINDS, DIFFICULTY, DRAFTED_ADVANCED, DRAFTED_BASIC, MAX_RISE, PACE_TILES_PER_SECOND, generateLevel, introductions, maxGapTiles } from "../logic/generator.mjs";
import { computeEnvelope } from "../logic/physics.mjs";
import { CHUNKS } from "../logic/chunks.mjs";
import { CRON_HEIGHTS, CRON_PERIODS } from "../logic/enemies.mjs";
import { SCREEN_COLS, SCREEN_ROWS, TILE } from "../logic/screen.mjs";

const LEVELS = [1, 2, 3, 4, 5];
const SEEDS = Array.from({ length: 60 }, (_, i) => Math.imul(i + 1, 0x9e3779b1) >>> 0);
const MAX_SECONDS = 90;

function eachLevel(check) {
  for (const seed of SEEDS) for (const number of LEVELS) check(generateLevel(seed, number, 0), seed, number);
}

function isGround(tile) {
  return tile === "#" || tile === "B";
}

function surfaceRow(level, col) {
  for (let row = 0; row < SCREEN_ROWS; row++) if (isGround(level.rows[row][col])) return row;
  return SCREEN_ROWS;
}

function isPit(level, col) {
  return !isGround(level.rows[SCREEN_ROWS - 1][col]);
}

function pits(level) {
  const found = [];
  for (let col = 0; col < level.cols; col++) {
    if (!isPit(level, col) || isPit(level, col - 1)) continue;
    let end = col;
    while (isPit(level, end + 1)) end++;
    found.push({ start: col, width: end - col + 1, rise: surfaceRow(level, col - 1) - surfaceRow(level, end + 1) });
  }
  return found;
}

function platforms(level) {
  const found = [];
  level.rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== "=" || line[col - 1] === "=") continue;
      let end = col;
      while (line[end + 1] === "=") end++;
      found.push({ row, start: col, end });
    }
  });
  return found;
}

function supportBelow(level, row, col) {
  for (let below = row + 1; below < SCREEN_ROWS; below++) {
    const tile = level.rows[below][col];
    if (isGround(tile) || tile === "=") return below;
  }
  return Infinity;
}

function chunkAt(level, col) {
  return level.chunks.filter(chunk => col >= chunk.col && col < chunk.col + chunk.width)[0];
}

test("the same seed gives the same level", () => {
  for (const number of LEVELS) {
    assert.deepEqual(generateLevel(0x7f3a91c2, number, 0).rows, generateLevel(0x7f3a91c2, number, 0).rows);
  }
});

test("different seeds give different levels", () => {
  assert.notDeepEqual(generateLevel(1, 1, 0).rows, generateLevel(2, 1, 0).rows);
});

test("another attempt at the same level gives a different layout", () => {
  assert.notDeepEqual(generateLevel(0x7f3a91c2, 2, 1).rows, generateLevel(0x7f3a91c2, 2, 0).rows);
});

function tiers(intros) {
  return intros.map(kinds => ({ basic: kinds.filter(kind => BASIC_KINDS.includes(kind)), advanced: kinds.filter(kind => ADVANCED_KINDS.includes(kind)) }));
}

test("the draft holds four different basic enemies and three different advanced ones", () => {
  for (const seed of SEEDS) {
    const drafted = [].concat(...introductions(seed));

    assert.equal(new Set(drafted.filter(kind => BASIC_KINDS.includes(kind))).size, DRAFTED_BASIC);
    assert.equal(new Set(drafted.filter(kind => ADVANCED_KINDS.includes(kind))).size, DRAFTED_ADVANCED);
    assert.equal(drafted.length, DRAFTED_BASIC + DRAFTED_ADVANCED);
  }
});

test("level 1 introduces two basic enemies, level 2 one or two, level 4 the rest, levels 3 and 5 none", () => {
  const level2Counts = new Set();

  for (const seed of SEEDS) {
    const basic = tiers(introductions(seed)).map(level => level.basic);
    assert.equal(basic[0].length, 2);
    assert.ok(basic[1].length === 1 || basic[1].length === 2);
    assert.equal(basic[3].length, 2 - basic[1].length);
    assert.deepEqual([basic[2], basic[4]], [[], []]);
    level2Counts.add(basic[1].length);
  }

  assert.deepEqual([...level2Counts].sort(), [1, 2]);
});

test("advanced enemies join at level 3, one or two of them, and the rest at level 4", () => {
  const level3Counts = new Set();

  for (const seed of SEEDS) {
    const advanced = tiers(introductions(seed)).map(level => level.advanced);
    assert.deepEqual([advanced[0], advanced[1], advanced[4]], [[], [], []]);
    assert.ok(advanced[2].length === 1 || advanced[2].length === 2);
    assert.equal(advanced[3].length, DRAFTED_ADVANCED - advanced[2].length);
    level3Counts.add(advanced[2].length);
  }

  assert.deepEqual([...level3Counts].sort(), [1, 2]);
});

test("every enemy is sometimes left out of the draft", () => {
  const leftOut = new Set();

  for (const seed of SEEDS) {
    const drafted = [].concat(...introductions(seed));
    for (const kind of BASIC_KINDS.concat(ADVANCED_KINDS)) if (!drafted.includes(kind)) leftOut.add(kind);
  }

  assert.equal(leftOut.size, BASIC_KINDS.length + ADVANCED_KINDS.length);
});

test("a level holds only enemies introduced in it or before", () => {
  eachLevel((level, seed, number) => {
    const allowed = [].concat(...introductions(seed).slice(0, number));
    for (const enemy of level.enemies) assert.ok(allowed.includes(enemy.kind), enemy.kind + " in level " + number);
  });
});

test("each enemy first appears in a safe introduction chunk for it", () => {
  eachLevel((level, seed, number) => {
    for (const kind of introductions(seed)[number - 1]) {
      const first = level.enemies.filter(enemy => enemy.kind === kind).sort((a, b) => a.col - b.col)[0];
      const chunk = chunkAt(level, first.col);
      assert.equal(chunk.intro, kind);
      for (let col = chunk.col; col < chunk.col + chunk.width; col++) assert.ok(!isPit(level, col));
    }
  });
});

test("every pit is narrower than the level's fraction of the envelope for its rise", () => {
  eachLevel((level, seed, number) => {
    for (const pit of pits(level)) {
      assert.ok(pit.rise <= MAX_RISE, "rise " + pit.rise);
      assert.ok(pit.width <= maxGapTiles(number, pit.rise), "level " + number + " pit of " + pit.width + " at " + pit.start);
    }
  });
});

test("the widest pit allowed is within the envelope fraction in pixels", () => {
  const envelope = computeEnvelope();

  for (const number of LEVELS) {
    for (let rise = 0; rise <= MAX_RISE; rise++) {
      assert.ok(maxGapTiles(number, rise) * TILE <= DIFFICULTY[number - 1].gapFraction * envelope.maxGapByRise[rise]);
    }
  }
});

test("no step up the ground is higher than the rise limit", () => {
  eachLevel(level => {
    for (let col = 0; col + 1 < level.cols; col++) {
      if (isPit(level, col) || isPit(level, col + 1)) continue;
      assert.ok(surfaceRow(level, col) - surfaceRow(level, col + 1) <= MAX_RISE, "step at " + col);
    }
  });
});

test("every platform can be jumped onto from right below it", () => {
  eachLevel(level => {
    for (const platform of platforms(level)) {
      let lowest = Infinity;
      for (let col = platform.start; col <= platform.end; col++) lowest = Math.min(lowest, supportBelow(level, platform.row, col) - platform.row);
      assert.ok(lowest <= MAX_RISE, "platform at row " + platform.row + " col " + platform.start);
    }
  });
});

test("no platform is narrower than the level allows", () => {
  eachLevel((level, seed, number) => {
    for (const platform of platforms(level)) assert.ok(platform.end - platform.start + 1 >= DIFFICULTY[number - 1].narrowestPlatform);
  });
});

test("a level takes its target time at the expected pace, growing with the level and never over 90 seconds", () => {
  for (const number of LEVELS) {
    const target = DIFFICULTY[number - 1].seconds;
    for (const seed of SEEDS) {
      const seconds = generateLevel(seed, number, 0).cols / PACE_TILES_PER_SECOND;
      assert.ok(seconds >= target && seconds <= MAX_SECONDS, "level " + number + " takes " + seconds + " s");
    }
    if (number > 1) assert.ok(target > DIFFICULTY[number - 2].seconds);
  }
});

test("a level has a start, a checkpoint in its middle third and an exit at the end", () => {
  eachLevel(level => {
    assert.ok(level.start.col < level.checkpoint.col && level.checkpoint.col < level.exit.col);
    assert.ok(Math.abs(level.checkpoint.col - level.cols / 2) < level.cols / 6, "checkpoint at " + level.checkpoint.col + " of " + level.cols);
    assert.ok(level.exit.col > level.cols - SCREEN_COLS / 2);
  });
});

test("exactly one bit holds sudo and the level has plain bits too", () => {
  eachLevel(level => {
    assert.equal(level.bits.filter(bit => bit.sudo).length, 1);
    assert.ok(level.bits.filter(bit => !bit.sudo).length > 10);
  });
});

test("a rest zone comes at least as often as the level asks", () => {
  eachLevel((level, seed, number) => {
    let sinceRest = 0;
    for (const chunk of level.chunks) {
      sinceRest = chunk.role === "body" ? sinceRest + 1 : 0;
      assert.ok(sinceRest <= DIFFICULTY[number - 1].restEvery);
    }
  });
});

test("two of the hardest chunks never come back to back", () => {
  eachLevel(level => {
    for (let i = 1; i < level.chunks.length; i++) assert.ok(!(level.chunks[i].difficulty === 3 && level.chunks[i - 1].difficulty === 3));
  });
});

test("the first part of a level holds only the easiest body chunks", () => {
  eachLevel(level => {
    for (const chunk of level.chunks) if (chunk.role === "body" && chunk.col < level.cols / 6) assert.equal(chunk.difficulty, 1, chunk.name);
  });
});

test("every level holds about as many enemies per screen as the table says", () => {
  for (const number of LEVELS) {
    let enemies = 0;
    let cols = 0;
    for (const seed of SEEDS) {
      const level = generateLevel(seed, number, 0);
      enemies += level.enemies.length;
      cols += level.cols;
    }
    assert.ok(Math.abs((enemies / cols) * SCREEN_COLS - DIFFICULTY[number - 1].enemiesPerScreen) < 0.15);
  }
});

test("each cron vent and pipe gets its own rhythm from the seed", () => {
  const timed = [];
  eachLevel(level => {
    for (const enemy of level.enemies) if (enemy.kind === "cron" || enemy.kind === "pipe") timed.push(enemy);
  });
  const crons = timed.filter(enemy => enemy.kind === "cron");
  const pipes = timed.filter(enemy => enemy.kind === "pipe");

  assert.ok(crons.every(cron => CRON_PERIODS.includes(cron.period) && CRON_HEIGHTS.includes(cron.height) && cron.phase >= 0 && cron.phase < cron.period));
  assert.equal(new Set(crons.map(cron => cron.period)).size, CRON_PERIODS.length);
  assert.equal(new Set(crons.map(cron => cron.height)).size, CRON_HEIGHTS.length);
  assert.ok(new Set(pipes.map(pipe => pipe.jitter)).size > pipes.length / 2);
  assert.ok(new Set(timed.map(enemy => enemy.phase)).size > timed.length / 2);
});

test("the same seed gives the same rhythms", () => {
  const timings = level => level.enemies.map(enemy => [enemy.period, enemy.height, enemy.phase, enemy.jitter]);

  for (const number of [3, 4, 5]) assert.deepEqual(timings(generateLevel(0x7f3a91c2, number, 0)), timings(generateLevel(0x7f3a91c2, number, 0)));
});

test("a chunk whose slots go together is filled whole with one kind or left empty", () => {
  const counts = new Set();

  eachLevel(level => {
    for (const chunk of level.chunks.filter(placed => CHUNKS.filter(c => c.name === placed.name)[0].together)) {
      const inside = level.enemies.filter(enemy => enemy.col >= chunk.col && enemy.col < chunk.col + chunk.width);
      assert.ok(inside.length === 0 || inside.length === 3, chunk.name + " holds " + inside.length);
      assert.ok(new Set(inside.map(enemy => enemy.kind)).size <= 1);
      counts.add(inside.length);
    }
  });

  assert.deepEqual([...counts].sort(), [0, 3]);
});
