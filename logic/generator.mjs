import { TILE, SCREEN_ROWS, SCREEN_COLS } from "./screen.mjs";
import { computeEnvelope } from "./physics.mjs";
import { CRON_HEIGHTS, CRON_PERIODS, PIPE_DOWN_SECONDS, SPINLOCK_ARMS, SPINLOCK_PERIOD } from "./enemies.mjs";
import { ENEMY_KINDS, parseLevel } from "./level.mjs";
import { subStream, randomInt, pick, shuffle } from "./random.mjs";
import { CHUNKS } from "./chunks.mjs";

export const BASIC_KINDS = ["bug", "zombie", "spikes", "ping", "hang"];
export const ADVANCED_KINDS = ["cron", "pipe", "pointer", "fork", "leak", "spinlock"];
export const DEFAULT_KINDS = BASIC_KINDS.concat(["fork"]);
export const DRAFTED_BASIC = 4;
export const DRAFTED_ADVANCED = 4;
export const PACE_TILES_PER_SECOND = 4;
export const MAX_LEVEL_SECONDS = 90;
export const HANG_ROW = 4;
export const DIFFICULTY = [
  { gapFraction: 0.6, enemiesPerScreen: 1.5, narrowestPlatform: 4, restEvery: 3, seconds: 60, hazardsPerScreen: [2, 3.5] },
  { gapFraction: 0.65, enemiesPerScreen: 2, narrowestPlatform: 3, restEvery: 3, seconds: 66, hazardsPerScreen: [2.5, 4] },
  { gapFraction: 0.72, enemiesPerScreen: 2.5, narrowestPlatform: 3, restEvery: 4, seconds: 72, hazardsPerScreen: [3, 4.5] },
  { gapFraction: 0.8, enemiesPerScreen: 3, narrowestPlatform: 2, restEvery: 4, seconds: 78, hazardsPerScreen: [3.25, 4.5] },
  { gapFraction: 0.88, enemiesPerScreen: 3.1, narrowestPlatform: 2, restEvery: 5, seconds: 84, hazardsPerScreen: [3.5, 4.75] },
];

const ENVELOPE = computeEnvelope();
export const MAX_RISE = Math.floor(ENVELOPE.maxJumpHeight / TILE) - 1;

const EMPTY = ".";
const GAP = "G";
const LIFT_PLATFORM = "P";
const PLATFORM = "=";
const SLOT = "E";
const PATH_BIT = "*";
const RISKY_BIT = "+";
const SPIKES = "^";
const SUDO_BIT = "S";
const PIPE = "H";
const PIPE_HEIGHT = 3;
const PUDDLE = "~";
const GAP_BIT_HEIGHT = 2;
const HARDEST = 3;
const EASY_SHARE = 0.2;
const MEDIUM_SHARE = 0.55;
const BOTTOM_ROW = SCREEN_ROWS - 1;

export function maxGapTiles(levelNumber, rise) {
  return Math.floor((DIFFICULTY[levelNumber - 1].gapFraction * ENVELOPE.maxGapByRise[Math.max(rise, 0)]) / TILE);
}

export function introductions(seed) {
  const random = subStream(seed, "draft-basic");
  const drafted = shuffle(random, BASIC_KINDS).slice(0, DRAFTED_BASIC);
  const afterLevel2 = 2 + randomInt(random, 1, 2);
  const advancedRandom = subStream(seed, "draft-advanced");
  const advanced = shuffle(advancedRandom, ADVANCED_KINDS).slice(0, DRAFTED_ADVANCED);
  const atLevel3 = randomInt(advancedRandom, 1, 2);
  return [drafted.slice(0, 2), drafted.slice(2, afterLevel2), advanced.slice(0, atLevel3), drafted.slice(afterLevel2).concat(advanced.slice(atLevel3)), []];
}

export function kindsUpTo(intros, levelNumber) {
  let kinds = [];
  for (let i = 0; i < levelNumber; i++) kinds = kinds.concat(intros[i]);
  return kinds;
}

function isGround(tile) {
  return tile === "#" || tile === "B";
}

function supports(tile) {
  return isGround(tile) || tile === PLATFORM || tile === LIFT_PLATFORM;
}

function paddedGrid(map) {
  const grid = [];
  for (let row = 0; row < SCREEN_ROWS - map.length; row++) grid.push(EMPTY.repeat(map[0].length).split(""));
  for (const line of map) grid.push(line.split(""));
  return grid;
}

function isGapColumn(grid, col) {
  return grid[BOTTOM_ROW][col] === GAP;
}

function surfaceRow(grid, col) {
  for (let row = 0; row < SCREEN_ROWS; row++) if (isGround(grid[row][col])) return row;
  return SCREEN_ROWS;
}

function gapRuns(grid) {
  const runs = [];
  const cols = grid[0].length;
  for (let col = 0; col < cols; col++) {
    if (!isGapColumn(grid, col) || (col > 0 && isGapColumn(grid, col - 1))) continue;
    let end = col;
    while (end + 1 < cols && isGapColumn(grid, end + 1)) end++;
    const left = surfaceRow(grid, col - 1);
    const right = surfaceRow(grid, end + 1);
    runs.push({ start: col, end, rise: left - right, bitRow: Math.min(left, right) - GAP_BIT_HEIGHT });
  }
  return runs;
}

function narrowestFooting(grid) {
  let narrowest = Infinity;
  for (const line of grid) {
    for (let col = 0; col < line.length; col++) {
      if (!(line[col] === PLATFORM || line[col] === LIFT_PLATFORM) || line[col - 1] === line[col]) continue;
      let end = col;
      while (line[end + 1] === line[col]) end++;
      narrowest = Math.min(narrowest, end - col + 1);
    }
  }
  const runs = gapRuns(grid);
  for (let i = 1; i < runs.length; i++) narrowest = Math.min(narrowest, runs[i].start - runs[i - 1].end - 1);
  return narrowest;
}

function chunkFits(chunk, levelNumber, kinds) {
  if (levelNumber < (chunk.minLevel || 1)) return false;
  const grid = paddedGrid(chunk.map);
  if (narrowestFooting(grid) < DIFFICULTY[levelNumber - 1].narrowestPlatform) return false;
  if (chunk.kinds && !chunk.kinds.some(kind => kinds.indexOf(kind) >= 0)) return false;
  return gapRuns(grid).every(run => chunk.gap[0] <= maxGapTiles(levelNumber, run.rise));
}

function liftHeadroom(grid, row) {
  let headroom = Infinity;
  for (let col = 0; col < grid[row].length; col++) {
    if (grid[row][col] !== LIFT_PLATFORM) continue;
    let support = row + 1;
    while (!supports(grid[support][col])) support++;
    headroom = Math.min(headroom, MAX_RISE - (support - row));
  }
  return headroom;
}

function applyLift(grid, chunk, random) {
  let lowest = -1;
  grid.forEach((line, row) => {
    if (line.indexOf(LIFT_PLATFORM) >= 0) lowest = row;
  });
  if (lowest < 0) return grid;
  const lift = randomInt(random, 0, Math.min(chunk.lift, liftHeadroom(grid, lowest)));
  const lifted = grid.slice(lift, lowest + 1);
  for (let i = 0; i < lift; i++) lifted.push(EMPTY.repeat(grid[0].length).split(""));
  return lifted.concat(grid.slice(lowest + 1)).map(line => line.map(tile => (tile === LIFT_PLATFORM ? PLATFORM : tile)));
}

function expandGaps(grid, chunk, levelNumber, random) {
  const rows = grid.map(() => []);
  const copyColumn = (col, tileFor) => grid.forEach((line, row) => rows[row].push(tileFor(line[col], row)));
  let col = 0;
  for (const run of gapRuns(grid)) {
    while (col < run.start) copyColumn(col++, tile => tile);
    const width = randomInt(random, chunk.gap[0], Math.min(chunk.gap[1], maxGapTiles(levelNumber, run.rise)));
    for (let i = 0; i < width; i++) {
      const bitHere = i === Math.floor(width / 2);
      copyColumn(run.start, (tile, row) => (bitHere && row === run.bitRow ? PATH_BIT : EMPTY));
    }
    col = run.end + 1;
  }
  while (col < grid[0].length) copyColumn(col++, tile => tile);
  return rows;
}

function buildChunk(chunk, levelNumber, random) {
  return expandGaps(applyLift(paddedGrid(chunk.map), chunk, random), chunk, levelNumber, random);
}

function chunkNamed(name) {
  return CHUNKS.filter(chunk => chunk.name === name)[0];
}

function introChunk(kind) {
  const own = CHUNKS.filter(chunk => chunk.role === "intro" && chunk.kinds && chunk.kinds.indexOf(kind) >= 0);
  return own.length > 0 ? own[0] : chunkNamed("intro");
}

function targetDifficulty(progress) {
  if (progress < EASY_SHARE) return 1;
  return progress < MEDIUM_SHARE ? 2 : HARDEST;
}

function widestBuild(chunk) {
  const grid = paddedGrid(chunk.map);
  let width = grid[0].length;
  for (const run of gapRuns(grid)) width += chunk.gap[1] - (run.end - run.start + 1);
  return width;
}

function chooseBody(random, body, previous, progress, room) {
  const target = targetDifficulty(progress);
  const candidates = body.filter(chunk => chunk.difficulty <= target && chunk.name !== previous.name && !(chunk.difficulty === HARDEST && previous.difficulty === HARDEST) && widestBuild(chunk) <= room);
  const weighted = [];
  for (const chunk of candidates) {
    weighted.push(chunk);
    if (chunk.difficulty === target) weighted.push(chunk);
  }
  return pick(random, weighted);
}

function slotsIn(grid, placed) {
  const slots = [];
  grid.forEach((line, row) => {
    for (let col = placed.col; col < placed.col + placed.width; col++) {
      if (line[col] !== SLOT || line[col - 1] === SLOT) continue;
      let end = col;
      while (line[end + 1] === SLOT) end++;
      slots.push({ placed, row, start: col, end });
    }
  });
  return slots;
}

function tileOf(kind) {
  return Object.keys(ENEMY_KINDS).filter(tile => ENEMY_KINDS[tile] === kind)[0];
}

function fillSlot(grid, slot, kind) {
  for (let col = slot.start; col <= slot.end; col++) grid[slot.row][col] = kind === "spikes" ? SPIKES : EMPTY;
  if (kind === null) return;
  const center = Math.floor((slot.start + slot.end) / 2);
  if (kind === "hang") grid[HANG_ROW][center] = tileOf(kind);
  else if (kind === "pipe") placePipe(grid, slot);
  else if (kind === "leak") placeLeak(grid, slot);
  else if (kind !== "spikes") grid[slot.row][center] = tileOf(kind);
}

function placePipe(grid, slot) {
  for (let row = slot.row - PIPE_HEIGHT + 1; row <= slot.row; row++) {
    grid[row][slot.start] = PIPE;
    grid[row][slot.start + 1] = PIPE;
  }
  grid[slot.row - PIPE_HEIGHT][slot.start] = tileOf("pipe");
}

function placeLeak(grid, slot) {
  for (let col = slot.start; col < slot.end; col++) grid[slot.row][col] = PUDDLE;
  grid[slot.row][slot.end] = tileOf("leak");
}

function slotFits(slot, kind) {
  const width = slot.end - slot.start + 1;
  return kind === "pipe" || kind === "leak" ? width >= 2 : true;
}

function slotGroups(chunk, slots) {
  if (chunkNamed(chunk.name).together) return slots.length > 0 ? [slots] : [];
  return slots.map(slot => [slot]);
}

function placeEnemies(grid, placed, levelNumber, kinds, random) {
  const units = [];
  let introduced = 0;
  for (const chunk of placed) {
    const slots = slotsIn(grid, chunk);
    if (chunk.intro) {
      for (const slot of slots) fillSlot(grid, slot, chunk.intro);
      introduced += slots.length;
      continue;
    }
    const allowed = chunkNamed(chunk.name).kinds || DEFAULT_KINDS;
    for (const group of slotGroups(chunk, slots)) {
      units.push({ slots: group, kinds: allowed.filter(kind => kinds.indexOf(kind) >= 0 && group.every(slot => slotFits(slot, kind))) });
    }
  }
  let wanted = Math.round((DIFFICULTY[levelNumber - 1].enemiesPerScreen * grid[0].length) / SCREEN_COLS) - introduced;
  const chosen = [];
  for (const unit of shuffle(random, units.filter(candidate => candidate.kinds.length > 0))) {
    if (wanted <= 0) break;
    chosen.push(unit);
    wanted -= unit.slots.length;
  }
  for (const unit of units) {
    const kind = chosen.indexOf(unit) >= 0 ? pick(random, unit.kinds) : null;
    for (const slot of unit.slots) fillSlot(grid, slot, kind);
  }
}

function placeBits(grid, random) {
  const path = [];
  const risky = [];
  grid.forEach((line, row) => {
    line.forEach((tile, col) => {
      if (tile === PATH_BIT) path.push({ row, col });
      else if (tile === RISKY_BIT) risky.push({ row, col });
    });
  });
  for (const spot of path.concat(risky)) grid[spot.row][spot.col] = random.next() < 0.5 ? "0" : "1";
  const sudoSpots = risky.length > 0 && (path.length === 0 || random.next() < 0.5) ? risky : path;
  const sudo = pick(random, sudoSpots);
  grid[sudo.row][sudo.col] = SUDO_BIT;
}

export function levelColumns(levelNumber) {
  return Math.round(DIFFICULTY[levelNumber - 1].seconds * PACE_TILES_PER_SECOND);
}

export function generateLevel(seed, levelNumber, attempt) {
  const kinds = kindsUpTo(introductions(seed), levelNumber);
  const body = CHUNKS.filter(chunk => chunk.role === "body" && chunkFits(chunk, levelNumber, kinds));
  return assembleLevel(seed, levelNumber, "attempt-" + attempt, body);
}

export function generateSafeLevel(seed, levelNumber) {
  const kinds = kindsUpTo(introductions(seed), levelNumber);
  const body = CHUNKS.filter(chunk => chunk.role === "body" && chunk.difficulty === 1 && !chunk.gap && chunkFits(chunk, levelNumber, kinds));
  return assembleLevel(seed, levelNumber, "safe", body);
}

function assembleLevel(seed, levelNumber, label, body) {
  const random = subStream(seed, "level-" + levelNumber + "-" + label);
  const intros = introductions(seed);
  const kinds = kindsUpTo(intros, levelNumber);
  const table = DIFFICULTY[levelNumber - 1];
  const targetCols = levelColumns(levelNumber);
  const rests = CHUNKS.filter(chunk => chunk.role === "rest");
  const exit = chunkNamed("exit");
  const grid = [];
  for (let row = 0; row < SCREEN_ROWS; row++) grid.push([]);
  const placed = [];
  let cols = 0;

  const place = (chunk, intro) => {
    const rows = buildChunk(chunk, levelNumber, random);
    rows.forEach((line, row) => {
      for (const tile of line) grid[row].push(tile);
    });
    const entry = { name: chunk.name, role: chunk.role, difficulty: chunk.difficulty, col: cols, width: rows[0].length, intro: intro || null };
    placed.push(entry);
    cols += entry.width;
    return entry;
  };

  let previous = place(chunkNamed("start"));
  for (const kind of intros[levelNumber - 1]) previous = place(introChunk(kind), kind);
  let sinceRest = 0;
  let checkpointPlaced = false;
  while (cols + exit.map[0].length < targetCols) {
    if (!checkpointPlaced && cols >= targetCols / 2) {
      previous = place(chunkNamed("checkpoint"));
      checkpointPlaced = true;
    } else if (sinceRest === table.restEvery) {
      previous = place(pick(random, rests));
      sinceRest = 0;
    } else {
      const room = MAX_LEVEL_SECONDS * PACE_TILES_PER_SECOND - cols - exit.map[0].length;
      previous = place(chooseBody(random, body, previous, cols / targetCols, room));
      sinceRest++;
    }
  }
  place(exit);

  placeEnemies(grid, placed, levelNumber, kinds, random);
  placeBits(grid, random);
  const level = parseLevel(grid.map(line => line.join("")));
  level.chunks = placed;
  drawTimings(level, random);
  return level;
}

export function spinlockArms(chunkName) {
  return chunkNamed(chunkName).arms || SPINLOCK_ARMS;
}

export function spinlockDoubles(chunkName, arm) {
  return (chunkNamed(chunkName).doubles || []).indexOf(arm) >= 0 ? [false, true] : [false];
}

function drawSpinlock(enemy, level, random, groups) {
  const chunk = level.chunks.filter(placed => enemy.col >= placed.col && enemy.col < placed.col + placed.width)[0];
  const first = groups[chunk.col];
  if (first) {
    enemy.arm = first.arm;
    enemy.spin = first.spin;
    enemy.double = first.double;
    enemy.phase = (first.phase + (chunkNamed(chunk.name).spinOffset || 0) * SPINLOCK_PERIOD) % SPINLOCK_PERIOD;
    return;
  }
  enemy.arm = pick(random, spinlockArms(chunk.name));
  enemy.spin = pick(random, [-1, 1]);
  enemy.double = pick(random, spinlockDoubles(chunk.name, enemy.arm));
  enemy.phase = random.next() * SPINLOCK_PERIOD;
  groups[chunk.col] = enemy;
}

function drawTimings(level, random) {
  const spinlockGroups = {};
  for (const enemy of level.enemies) {
    if (enemy.kind === "spinlock") {
      drawSpinlock(enemy, level, random, spinlockGroups);
    } else if (enemy.kind === "cron") {
      enemy.period = pick(random, CRON_PERIODS);
      enemy.height = pick(random, CRON_HEIGHTS);
      enemy.phase = random.next() * enemy.period;
    } else if (enemy.kind === "pipe") {
      enemy.phase = random.next() * PIPE_DOWN_SECONDS;
      enemy.jitter = Math.floor(random.next() * 0x100000000);
    }
  }
}
