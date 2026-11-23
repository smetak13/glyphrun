import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ATTEMPTS, playableLevel, searchPath, validateLevel } from "../logic/validator.mjs";
import { BASIC_KINDS, generateLevel, generateSafeLevel } from "../logic/generator.mjs";
import { CHUNKS } from "../logic/chunks.mjs";
import { parseLevel } from "../logic/level.mjs";
import { createEnemy, stepEnemies } from "../logic/enemies.mjs";
import { computeEnvelope, createHero, RUN_SPEED } from "../logic/physics.mjs";
import { CAMERA_FOLLOW_RATE, CAMERA_LEAD } from "../logic/world.mjs";
import { STEP_SECONDS } from "../logic/clock.mjs";
import { SCREEN_ROWS, SCREEN_WIDTH } from "../logic/screen.mjs";

const SEED = 1;
const LEVELS = [1, 2, 3, 4, 5];
const SAMPLE = Array.from({ length: 200 }, (_, i) => Math.imul(i + 1, 0x2545f491) >>> 0);
const PHASES = Array.from({ length: 16 }, (_, i) => i * 0.25);
const CHUNK_MARGIN = 10;

function ground(width) {
  return "#".repeat(width);
}

function segment(name, role, lines, intro) {
  const width = lines[0].length;
  return { name, role, intro: intro || null, lines: lines.concat([ground(width), ground(width), ground(width)]) };
}

function start(sudoHeight) {
  const lines = ["....S..."];
  for (let i = 1; i < sudoHeight; i++) lines.push("........");
  return segment("start", "start", lines.concat(["..@....."]));
}

function gap(width) {
  const pit = "####" + ".".repeat(width) + "######";
  return { name: "gap", role: "body", intro: null, lines: [".".repeat(pit.length), pit, pit, pit] };
}

const INTRO_PING = segment("intro", "intro", [".......o......"], "ping");
const INTRO_BUG = segment("intro", "intro", [".......b......"], "bug");
const REST = segment("rest-bits", "rest", ["..0.1.0."]);
const CHECKPOINT = segment("checkpoint", "checkpoint", ["....C..."]);
const FLAT_BUG = segment("flat-enemy", "body", [".....b...."]);
const EXIT = segment("exit", "exit", [".......X...."]);

function baseSegments() {
  return [start(1), INTRO_PING, INTRO_BUG, gap(2), gap(2), REST, CHECKPOINT, gap(2), gap(2), FLAT_BUG, EXIT];
}

function handMade(segments) {
  const rows = [];
  for (let row = 0; row < SCREEN_ROWS; row++) rows.push("");
  const chunks = [];
  let col = 0;
  for (const part of segments) {
    const width = part.lines[0].length;
    const padded = [];
    while (padded.length + part.lines.length < SCREEN_ROWS) padded.push(".".repeat(width));
    padded.concat(part.lines).forEach((line, row) => (rows[row] += line));
    chunks.push({ name: part.name, role: part.role, difficulty: part.role === "body" ? 1 : 0, col, width, intro: part.intro });
    col += width;
  }
  const level = parseLevel(rows);
  level.chunks = chunks;
  return level;
}

function replaced(index, part) {
  const segments = baseSegments();
  segments[index] = part;
  return segments;
}

function edgeTile(tile) {
  return tile === "#" || tile === "B" ? tile : ".";
}

function chunkAlone(level, chunk) {
  const rows = level.rows.map(line => {
    const inner = line.slice(chunk.col, chunk.col + chunk.width).replace(/[@CX01S]/g, ".");
    return edgeTile(inner[0]).repeat(CHUNK_MARGIN) + inner + edgeTile(inner[inner.length - 1]).repeat(CHUNK_MARGIN);
  });
  let row = SCREEN_ROWS - 1;
  while (edgeTile(rows[row][0]) !== ".") row--;
  return { level: parseLevel(rows), from: { col: 0, row } };
}

function passesAtPhase(alone, phase) {
  const enemies = alone.level.enemies.map(createEnemy);
  const faraway = createHero(-1000, 0);
  for (let i = 0; i < Math.round(phase / STEP_SECONDS); i++) stepEnemies(enemies, alone.level, faraway, STEP_SECONDS);
  return searchPath(alone.level, { from: alone.from, goalCol: alone.level.cols - 1, dynamic: true, enemies });
}

function hazardChunks() {
  const found = {};
  for (const seed of SAMPLE) {
    for (const number of LEVELS) {
      const level = generateLevel(seed, number, 0);
      for (const chunk of level.chunks) {
        const alone = chunkAlone(level, chunk);
        if (alone.level.enemies.length === 0) continue;
        const kinds = alone.level.enemies.map(enemy => enemy.kind).sort();
        found[chunk.name + ": " + kinds.join(", ")] = { name: chunk.name, kinds, alone };
      }
    }
  }
  return found;
}

function firstFailingFirstAttempt() {
  for (const seed of SAMPLE) {
    for (const number of LEVELS) if (validateLevel(generateLevel(seed, number, 0), seed, number).length > 0) return { seed, number };
  }
  return null;
}

test("the hand-made base level passes every rule", () => {
  assert.deepEqual(validateLevel(handMade(baseSegments()), SEED, 1), []);
});

test("a pit wider than the hero can jump blocks the way to the checkpoint", () => {
  const level = handMade(replaced(3, gap(7)));

  assert.deepEqual(validateLevel(level, SEED, 1), ["start to checkpoint", "start to exit while big", "hazard placement"]);
});

test("a pit the hero can only just jump is reachable but wider than level 1 allows", () => {
  const level = handMade(replaced(3, gap(6)));

  assert.deepEqual(validateLevel(level, SEED, 1), ["hazard placement"]);
});

test("a pit wider than the hero can jump after the checkpoint blocks the way to the exit", () => {
  const level = handMade(replaced(7, gap(7)));

  assert.deepEqual(validateLevel(level, SEED, 1), ["checkpoint to exit", "start to exit while big", "hazard placement"]);
});

test("a wall higher than the hero can jump blocks the way", () => {
  const wall = segment("stairs", "body", ["....BB....", "....BB....", "....BB....", "....BB....", "....BB...."]);

  assert.deepEqual(validateLevel(handMade(replaced(4, wall)), SEED, 1), ["start to checkpoint", "start to exit while big"]);
});

test("a wall the hero can only just jump onto is passable", () => {
  const wall = segment("stairs", "body", ["....BB....", "....BB....", "....BB....", "....BB...."]);

  assert.deepEqual(validateLevel(handMade(replaced(9, wall)), SEED, 1).filter(rule => rule !== "difficulty"), []);
});

test("a run of spikes too long to jump blocks the way", () => {
  const spikes = segment("spike-run", "body", ["..^^^^^^^^...."]);

  assert.deepEqual(validateLevel(handMade(replaced(4, spikes)), SEED, 1), ["start to checkpoint", "start to exit while big", "introductions"]);
});

test("a passage only the small hero fits under blocks the big hero", () => {
  const lines = [];
  for (let row = 0; row < SCREEN_ROWS - 4; row++) lines.push("....BBB.....");
  lines.push("............");

  assert.deepEqual(validateLevel(handMade(replaced(9, segment("stairs", "body", lines))), SEED, 1).filter(rule => rule !== "difficulty"), ["start to exit while big"]);
});

test("a sudo bit higher than the hero can jump is unreachable", () => {
  assert.deepEqual(validateLevel(handMade(replaced(0, start(8))), SEED, 1), ["sudo bit"]);
});

test("an enemy in a chunk not made for it breaks hazard placement", () => {
  const level = handMade(replaced(9, segment("hang-walk", "body", [".....b...."])));

  assert.deepEqual(validateLevel(level, SEED, 1), ["hazard placement"]);
});

test("an enemy not introduced yet breaks the introductions", () => {
  const level = handMade(replaced(9, segment("flat-enemy", "body", [".....z...."])));

  assert.deepEqual(validateLevel(level, SEED, 1), ["introductions"]);
});

test("an enemy seen before its introduction chunk breaks the introductions", () => {
  const segments = baseSegments();
  segments.splice(1, 0, segment("flat-enemy", "body", [".....o...."]));

  assert.deepEqual(validateLevel(handMade(segments), SEED, 1), ["introductions"]);
});

test("a level without a rest zone breaks the rest zones rule", () => {
  const level = handMade(replaced(5, segment("rest-bits", "body", ["..0.1.0."])));

  assert.deepEqual(validateLevel(level, SEED, 1), ["rest zones"]);
});

test("too few hazards per screen break the difficulty rule", () => {
  const segments = baseSegments();
  segments.splice(10, 0, REST, CHECKPOINT, REST, CHECKPOINT, REST, CHECKPOINT);

  assert.deepEqual(validateLevel(handMade(segments), SEED, 1), ["difficulty"]);
});

test("every level offered over a large seed sample passes the validator", () => {
  for (const seed of SAMPLE) {
    for (const number of LEVELS) {
      const level = playableLevel(seed, number);
      const failures = validateLevel(level, seed, number);
      assert.deepEqual(level.attempt === null ? failures.filter(rule => rule !== "difficulty") : failures, [], "seed " + seed + " level " + number);
    }
  }
});

test("the safe fallback layout of every level is completable", () => {
  for (const seed of SAMPLE.slice(0, 20)) {
    for (const number of LEVELS) {
      assert.deepEqual(validateLevel(generateSafeLevel(seed, number), seed, number).filter(rule => rule !== "difficulty"), []);
    }
  }
});

test("a level failing its first attempt is replaced by the next attempt that passes", () => {
  const { seed, number } = firstFailingFirstAttempt();

  const level = playableLevel(seed, number);

  assert.ok(level.attempt > 0 && level.attempt < MAX_ATTEMPTS);
  assert.deepEqual(level.rows, generateLevel(seed, number, level.attempt).rows);
});

test("the same seed is always offered the same level", () => {
  for (const number of LEVELS) assert.deepEqual(playableLevel(SAMPLE[0], number).rows, playableLevel(SAMPLE[0], number).rows);
});

test("every landing is on screen before the jump, even with the camera lagging at full speed", () => {
  const visibleAhead = SCREEN_WIDTH - CAMERA_LEAD - RUN_SPEED / CAMERA_FOLLOW_RATE;

  assert.ok(computeEnvelope().maxGap < visibleAhead);
});

test("every hazard chunk with every enemy it can hold has a safe passage at every phase", () => {
  const chunks = hazardChunks();
  const covered = {};

  for (const label of Object.keys(chunks)) {
    const chunk = chunks[label];
    for (const kind of chunk.kinds) covered[chunk.name + " " + kind] = true;
    for (const phase of PHASES) assert.ok(passesAtPhase(chunk.alone, phase), label + " at " + phase + " s");
  }

  for (const chunk of CHUNKS.filter(candidate => candidate.role === "body" && candidate.map.join("").includes("E"))) {
    for (const kind of chunk.kinds || BASIC_KINDS) assert.ok(covered[chunk.name + " " + kind], chunk.name + " never held " + kind);
  }
  for (const kind of BASIC_KINDS) assert.ok(covered["intro " + kind], "intro never held " + kind);
});

test("a bug in a corridor too low to jump has no safe passage", () => {
  const lines = [];
  for (let row = 0; row < SCREEN_ROWS - 4; row++) lines.push("BBBBBBBBBBBBBBBBBBBB");
  lines.push("..........b.........");
  const level = handMade([segment("flat-enemy", "body", lines)]);

  assert.ok(!passesAtPhase(chunkAlone(level, level.chunks[0]), 0));
});
