import { TILE, SCREEN_HEIGHT, SCREEN_ROWS, SCREEN_COLS } from "./screen.mjs";
import { STEP_SECONDS } from "./clock.mjs";
import { createHero, stepHero, heroHeight } from "./physics.mjs";
import { createEnemy, stepEnemies, touchEnemies, PING_AIR_SECONDS, PING_GROUND_SECONDS } from "./enemies.mjs";
import { keepInsideLevel, touchesBit } from "./world.mjs";
import { CHUNKS } from "./chunks.mjs";
import { BASIC_KINDS, DIFFICULTY, MAX_RISE, generateLevel, generateSafeLevel, introductions, kindsUpTo, maxGapTiles } from "./generator.mjs";

export const MAX_ATTEMPTS = 8;

const NO_JUMP = -1;
const WALK_STEPS = 12;
const MAX_MACRO_STEPS = 360;
const FULL_HOLD = 60;
const MID_HOLD = 18;
const SHORT_HOLD = 4;
const BRAKE_AFTER = 24;
const X_BUCKET = 6;
const VX_BUCKET = 72;
const ENEMY_BUCKET = 4;
const PHASE_BUCKET = 0.05;
const NEARBY = 12 * TILE;
const BEHIND = 8 * TILE;
const BEYOND = 10 * TILE;
const MAX_DYNAMIC_SECONDS = 12;

const WAIT = { direction: 0, hold: NO_JUMP };
const MACROS = [
  { direction: 1, hold: NO_JUMP },
  { direction: 1, hold: FULL_HOLD, air: 1 },
  { direction: 1, hold: MID_HOLD, air: 1 },
  { direction: 1, hold: SHORT_HOLD, air: 1 },
  { direction: 1, hold: FULL_HOLD, air: 0 },
  WAIT,
  { direction: 0, hold: FULL_HOLD, air: 0 },
  { direction: 0, hold: SHORT_HOLD, air: 0 },
  { direction: -1, hold: FULL_HOLD, air: 0 },
  { direction: -1, hold: FULL_HOLD, air: -1 },
  { direction: -1, hold: SHORT_HOLD, air: -1 },
  { direction: -1, hold: NO_JUMP },
];

function copyHero(hero) {
  return Object.assign({}, hero);
}

function copyEnemies(enemies) {
  return enemies.map(enemy => Object.assign({}, enemy));
}

function inputAt(macro, step) {
  if (macro.hold === NO_JUMP) return { direction: macro.direction, jumpHeld: false, jumpPressed: false };
  const direction = macro.air === macro.direction || step < BRAKE_AFTER ? macro.direction : macro.air;
  return { direction, jumpHeld: step < macro.hold, jumpPressed: step === 0 };
}

function pingPhase(enemy) {
  const cycle = PING_GROUND_SECONDS + PING_AIR_SECONDS;
  return enemy.kind === "ping" ? Math.round(((enemy.time + enemy.phase) % cycle) / PHASE_BUCKET) : 0;
}

function enemyKey(enemy) {
  const position = Math.round(enemy.x / ENEMY_BUCKET) + "," + Math.round(enemy.y / ENEMY_BUCKET);
  return [enemy.alive ? 1 : 0, enemy.state, enemy.direction, position, pingPhase(enemy), Math.round(enemy.lying / PHASE_BUCKET)].join(",");
}

function heroKey(hero) {
  return Math.round(hero.x / X_BUCKET) + ":" + hero.y + ":" + Math.round(hero.vx / VX_BUCKET);
}

function nodeKey(node, dynamic) {
  return dynamic ? heroKey(node.hero) + "|" + node.enemies.map(enemyKey).join(";") : heroKey(node.hero);
}

function onlyWaited(macro, node, next) {
  return macro !== WAIT && heroKey(next.hero) === heroKey(node.hero);
}

function nearbyEnemies(enemies, x) {
  return enemies.filter(enemy => Math.abs(enemy.x - x) < NEARBY + enemy.width);
}

function runMacro(search, node, macro) {
  const level = search.level;
  const hero = copyHero(node.hero);
  const enemies = search.dynamic ? copyEnemies(node.enemies) : node.enemies;
  const touchable = search.dynamic ? enemies : nearbyEnemies(enemies, hero.x);
  let time = node.time;
  let left = false;
  for (let step = 0; step < MAX_MACRO_STEPS; step++) {
    const previousBottom = hero.y;
    stepHero(hero, inputAt(macro, step), level, STEP_SECONDS);
    keepInsideLevel(hero, level);
    time += STEP_SECONDS;
    if (search.dynamic) stepEnemies(enemies, level, hero, STEP_SECONDS);
    if (touchEnemies(touchable, hero, previousBottom).some(event => event.type === "hit")) return null;
    if (hero.y - heroHeight(hero) > SCREEN_HEIGHT) return null;
    if (search.bit && touchesBit(hero, search.bit)) search.reached = true;
    if (hero.x >= search.goalX) search.reached = true;
    if (search.reached) return null;
    if (!hero.grounded) left = true;
    if (hero.grounded && (left || (macro.hold === NO_JUMP && step + 1 >= WALK_STEPS))) return { hero, enemies, time };
  }
  return null;
}

function inWindow(search, node) {
  return node.hero.x >= search.minX && node.hero.x <= search.maxX && node.time <= search.maxSeconds;
}

export function searchPath(level, options) {
  const from = options.from;
  const hero = createHero((from.col + 0.5) * TILE, (from.row + 1) * TILE);
  hero.big = options.big || false;
  const target = options.bit ? (options.bit.col + 0.5) * TILE : options.goalCol * TILE;
  const search = {
    level,
    dynamic: options.dynamic || false,
    bit: options.bit || null,
    goalX: options.bit ? Infinity : target,
    minX: hero.x - BEHIND,
    maxX: target + BEYOND,
    maxSeconds: options.dynamic ? MAX_DYNAMIC_SECONDS : Infinity,
    reached: false,
  };
  const enemies = options.enemies || level.enemies.filter(enemy => enemy.kind === "spikes").map(createEnemy);
  const start = { hero, enemies, time: 0 };
  const visited = {};
  visited[nodeKey(start, search.dynamic)] = true;
  const stack = [{ node: start, tried: 0 }];
  while (stack.length > 0 && !search.reached) {
    const top = stack[stack.length - 1];
    if (top.tried === MACROS.length) {
      stack.pop();
      continue;
    }
    const macro = MACROS[top.tried++];
    const next = runMacro(search, top.node, macro);
    if (next === null || !inWindow(search, next) || onlyWaited(macro, top.node, next)) continue;
    const key = nodeKey(next, search.dynamic);
    if (visited[key]) continue;
    visited[key] = true;
    stack.push({ node: next, tried: 0 });
  }
  return search.reached;
}

function reachable(level, from, goalCol, big) {
  return searchPath(level, { from, goalCol, big });
}

function sudoReachable(level) {
  const sudo = level.bits.filter(bit => bit.sudo)[0];
  const from = sudo.col < level.checkpoint.col ? level.start : level.checkpoint;
  return searchPath(level, { from, bit: sudo });
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

export function levelPits(level) {
  const pits = [];
  for (let col = 0; col < level.cols; col++) {
    if (!isPit(level, col) || isPit(level, col - 1)) continue;
    let end = col;
    while (end + 1 < level.cols && isPit(level, end + 1)) end++;
    pits.push({ col, width: end - col + 1, rise: surfaceRow(level, col - 1) - surfaceRow(level, end + 1) });
  }
  return pits;
}

export function hazardsPerScreen(level) {
  return ((level.enemies.length + levelPits(level).length) * SCREEN_COLS) / level.cols;
}

function chunkAt(level, col) {
  return level.chunks.filter(chunk => col >= chunk.col && col < chunk.col + chunk.width)[0];
}

function allowedKinds(chunk) {
  if (chunk.intro) return [chunk.intro];
  const definition = CHUNKS.filter(candidate => candidate.name === chunk.name)[0];
  return definition.kinds || BASIC_KINDS;
}

function restZonesOk(level, levelNumber) {
  let sinceRest = 0;
  let rests = 0;
  for (const chunk of level.chunks) {
    if (chunk.role === "rest") rests++;
    sinceRest = chunk.role === "body" ? sinceRest + 1 : 0;
    if (sinceRest > DIFFICULTY[levelNumber - 1].restEvery) return false;
  }
  return rests > 0;
}

function introductionsOk(level, seed, levelNumber) {
  const allowed = kindsUpTo(introductions(seed), levelNumber);
  if (level.enemies.some(enemy => allowed.indexOf(enemy.kind) < 0)) return false;
  return introductions(seed)[levelNumber - 1].every(kind => {
    const first = level.enemies.filter(enemy => enemy.kind === kind).sort((a, b) => a.col - b.col)[0];
    if (!first) return false;
    const chunk = chunkAt(level, first.col);
    if (chunk.intro !== kind) return false;
    for (let col = chunk.col; col < chunk.col + chunk.width; col++) if (isPit(level, col)) return false;
    return true;
  });
}

function hazardsPlacedOk(level, levelNumber) {
  if (level.enemies.some(enemy => allowedKinds(chunkAt(level, enemy.col)).indexOf(enemy.kind) < 0)) return false;
  return levelPits(level).every(pit => pit.rise <= MAX_RISE && pit.width <= maxGapTiles(levelNumber, pit.rise));
}

function difficultyOk(level, levelNumber) {
  const range = DIFFICULTY[levelNumber - 1].hazardsPerScreen;
  const score = hazardsPerScreen(level);
  return score >= range[0] && score <= range[1];
}

export function validateLevel(level, seed, levelNumber) {
  const rules = [
    ["start to checkpoint", () => reachable(level, level.start, level.checkpoint.col, false)],
    ["checkpoint to exit", () => reachable(level, level.checkpoint, level.exit.col, false)],
    ["start to exit while big", () => reachable(level, level.start, level.exit.col, true)],
    ["sudo bit", () => sudoReachable(level)],
    ["hazard placement", () => hazardsPlacedOk(level, levelNumber)],
    ["introductions", () => introductionsOk(level, seed, levelNumber)],
    ["rest zones", () => restZonesOk(level, levelNumber)],
    ["difficulty", () => difficultyOk(level, levelNumber)],
  ];
  return rules.filter(rule => !rule[1]()).map(rule => rule[0]);
}

export function playableLevel(seed, levelNumber) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const level = generateLevel(seed, levelNumber, attempt);
    if (validateLevel(level, seed, levelNumber).length === 0) {
      level.attempt = attempt;
      return level;
    }
  }
  const fallback = generateSafeLevel(seed, levelNumber);
  fallback.attempt = null;
  return fallback;
}
