import { TILE, SCREEN_HEIGHT, SCREEN_WIDTH } from "./screen.mjs";
import { tileAt } from "./level.mjs";
import { isSolid, heroHeight, HERO_WIDTH } from "./physics.mjs";
import { subStream } from "./random.mjs";

export const BUG_SPEED = 48;
export const ZOMBIE_SPEED = 30;
export const ZOMBIE_RANGE = 2 * TILE;
export const ZOMBIE_BOB = 4;
export const ZOMBIE_BOB_RATE = 2.5;
export const PING_GROUND_SECONDS = 0.9;
export const PING_AIR_SECONDS = 0.8;
export const PING_HOP_HEIGHT = 4 * TILE;
export const HANG_TRIGGER_DISTANCE = 5.5 * TILE;
export const HANG_GRAVITY = 1800;
export const HANG_MAX_FALL_SPEED = 900;
export const HANG_LIE_SECONDS = 1.5;
export const HANG_WINDUP_SPEED = 60;
export const CRON_PERIODS = [2.4, 3, 3.6];
export const CRON_HEIGHTS = [5, 6];
export const CRON_FIRE_SECONDS = 1;
export const PIPE_DOWN_SECONDS = 1.8;
export const PIPE_JITTER_SECONDS = 0.5;
export const PIPE_MOVE_SECONDS = 0.25;
export const PIPE_UP_SECONDS = 1;
export const PIPE_RISE = 36;
export const POINTER_PERIOD = 2.5;
export const POINTER_WARNING_SECONDS = 0.5;
export const POINTER_FIRST_SHOT_SECONDS = 1;
export const SHOT_SPEED = 180;
export const SHOT_LENGTH = 24;
export const SHOT_HEIGHT = 6;
export const SHOT_RANGE = SCREEN_WIDTH;
export const SMALL_FORK_SPEED = 84;
export const SPLIT_GRACE_SECONDS = 0.3;
export const SPLIT_DASH_SPEED = 300;
export const LEAK_GROW_SPEED = 3 * TILE;
export const LEAK_FULL_SECONDS = 0.8;
export const LEAK_SHRINK_SPEED = 4 * TILE;
export const LEAK_EMPTY_SECONDS = 0.6;
export const PUDDLE_HEIGHT = 6;
export const STOMP_BOUNCE_VELOCITY = 420;
export const STOMP_TOLERANCE = 6;
const HIT_INSET = 2;
const EDGE = 1e-6;

const SIZES = {
  bug: { width: 16, height: 16 },
  zombie: { width: 16, height: 20 },
  spikes: { width: TILE - 6, height: 10 },
  ping: { width: 16, height: 16 },
  hang: { width: 18, height: 18 },
  cron: { width: TILE - 4, height: 8 },
  pipe: { width: 24, height: PIPE_RISE },
  pointer: { width: 14, height: 14 },
  fork: { width: 16, height: 16 },
  leak: { width: 16, height: 14 },
};
const SMALL_FORK_SIZE = 12;
const KILLABLE = ["bug", "zombie", "ping", "hang", "fork", "leak"];

export function createEnemy(slot) {
  const size = SIZES[slot.kind];
  const tiles = slot.tiles || 1;
  const enemy = {
    kind: slot.kind,
    homeX: (slot.col + tiles / 2) * TILE,
    homeY: (slot.row + 1) * TILE,
    tiles,
    width: size.width + (tiles - 1) * TILE,
    height: size.height,
    phase: slot.phase || 0,
    period: slot.period || CRON_PERIODS[0],
    columnTiles: slot.height || CRON_HEIGHTS[0],
    jitter: slot.jitter || 0,
    extent: slot.extent || 0,
    small: false,
    startDirection: -1,
    alive: true,
  };
  resetEnemy(enemy);
  return enemy;
}

function forkChild(parent, direction) {
  const child = createEnemy({ kind: "fork", col: 0, row: 0 });
  child.homeX = parent.homeX;
  child.homeY = parent.homeY;
  child.width = SMALL_FORK_SIZE;
  child.height = SMALL_FORK_SIZE;
  child.small = true;
  child.startDirection = direction;
  child.parent = parent.id;
  child.alive = false;
  resetEnemy(child);
  return child;
}

export function createEnemies(slots) {
  const enemies = [];
  const add = enemy => {
    enemy.id = enemies.length;
    enemies.push(enemy);
    return enemy;
  };
  for (const slot of slots) {
    const enemy = add(createEnemy(slot));
    if (enemy.kind === "fork") {
      add(forkChild(enemy, -1));
      add(forkChild(enemy, 1));
    }
  }
  return enemies;
}

export function resetEnemy(enemy) {
  enemy.x = enemy.homeX;
  enemy.direction = enemy.startDirection;
  enemy.time = 0;
  enemy.state = enemy.kind === "hang" ? "hanging" : "moving";
  enemy.vy = 0;
  enemy.lying = 0;
  enemy.grace = 0;
  enemy.ghost = false;
  enemy.timer = enemy.phase;
  enemy.cycle = 0;
  enemy.downSeconds = enemy.kind === "pipe" ? pipeDownSeconds(enemy) : 0;
  enemy.y = enemy.kind === "pipe" ? pipeY(enemy) : enemy.homeY;
  enemy.previousY = enemy.y;
  enemy.charge = POINTER_PERIOD - POINTER_FIRST_SHOT_SECONDS;
  enemy.shots = [];
  enemy.seen = false;
  enemy.grown = 0;
}

function box(enemy, x) {
  return { left: x - enemy.width / 2, right: x + enemy.width / 2, top: enemy.y - enemy.height, bottom: enemy.y };
}

function overlaps(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function bumpsOther(enemy, x, enemies) {
  const moved = box(enemy, x);
  for (const other of enemies) {
    if (other === enemy || !other.alive) continue;
    if (Math.sign(other.x - enemy.x) === enemy.direction && overlaps(moved, box(other, other.x))) return true;
  }
  return false;
}

function supports(tile) {
  return isSolid(tile) || tile === "=";
}

function wallAhead(enemy, level, x) {
  const col = Math.floor((x + enemy.direction * (enemy.width / 2 - EDGE)) / TILE);
  const top = Math.floor((enemy.y - enemy.height) / TILE);
  const bottom = Math.floor((enemy.y - EDGE) / TILE);
  for (let row = top; row <= bottom; row++) if (isSolid(tileAt(level, col, row))) return true;
  return col < 0 || col >= level.cols;
}

function ledgeAhead(enemy, level, x) {
  const col = Math.floor((x + enemy.direction * (enemy.width / 2 - EDGE)) / TILE);
  return !supports(tileAt(level, col, Math.floor(enemy.y / TILE)));
}

function walk(enemy, level, enemies, speed, seconds) {
  const x = enemy.x + enemy.direction * speed * seconds;
  if (wallAhead(enemy, level, x) || ledgeAhead(enemy, level, x) || bumpsOther(enemy, x, enemies)) enemy.direction = -enemy.direction;
  else enemy.x = x;
}

function drift(enemy, level, enemies, seconds) {
  const x = enemy.x + enemy.direction * ZOMBIE_SPEED * seconds;
  if (Math.abs(x - enemy.homeX) > ZOMBIE_RANGE || wallAhead(enemy, level, x) || bumpsOther(enemy, x, enemies)) enemy.direction = -enemy.direction;
  else enemy.x = x;
  enemy.y = enemy.homeY + Math.sin(enemy.time * ZOMBIE_BOB_RATE) * ZOMBIE_BOB;
}

export function pingHeight(time) {
  const cycle = PING_GROUND_SECONDS + PING_AIR_SECONDS;
  const t = ((time % cycle) + cycle) % cycle - PING_GROUND_SECONDS;
  if (t <= 0) return 0;
  const u = t / PING_AIR_SECONDS;
  return 4 * PING_HOP_HEIGHT * u * (1 - u);
}

function hop(enemy) {
  enemy.y = enemy.homeY - pingHeight(enemy.time + enemy.phase);
}

function landingY(enemy, level) {
  const col = Math.floor(enemy.x / TILE);
  for (let row = Math.floor(enemy.homeY / TILE); row < level.rows.length; row++) {
    if (isSolid(tileAt(level, col, row))) return row * TILE;
  }
  return SCREEN_HEIGHT + enemy.height;
}

function hang(enemy, level, hero, seconds) {
  if (enemy.state === "hanging") {
    if (Math.abs(hero.x - enemy.x) < HANG_TRIGGER_DISTANCE && hero.y > enemy.y) enemy.state = "falling";
  } else if (enemy.state === "falling") {
    enemy.vy = Math.min(enemy.vy + HANG_GRAVITY * seconds, HANG_MAX_FALL_SPEED);
    enemy.y += enemy.vy * seconds;
    const ground = landingY(enemy, level);
    if (enemy.y >= ground) {
      enemy.y = ground;
      enemy.vy = 0;
      enemy.state = "lying";
      enemy.lying = HANG_LIE_SECONDS;
    }
  } else if (enemy.state === "lying") {
    enemy.lying = Math.max(enemy.lying - seconds, 0);
    if (enemy.lying === 0) enemy.state = "winding";
  } else {
    enemy.y = Math.max(enemy.y - HANG_WINDUP_SPEED * seconds, enemy.homeY);
    if (enemy.y === enemy.homeY) enemy.state = "hanging";
  }
}

export function cronState(enemy) {
  return (enemy.time + enemy.phase) % enemy.period >= enemy.period - CRON_FIRE_SECONDS ? "firing" : "idle";
}

function pipeDownSeconds(enemy) {
  return PIPE_DOWN_SECONDS + subStream(enemy.jitter, "pipe-" + enemy.cycle).next() * PIPE_JITTER_SECONDS;
}

export function pipeRaise(seconds) {
  if (seconds <= 0) return 0;
  if (seconds < PIPE_MOVE_SECONDS) return (PIPE_RISE * seconds) / PIPE_MOVE_SECONDS;
  const up = seconds - PIPE_MOVE_SECONDS - PIPE_UP_SECONDS;
  if (up <= 0) return PIPE_RISE;
  return Math.max(PIPE_RISE * (1 - up / PIPE_MOVE_SECONDS), 0);
}

const PIPE_UP_CYCLE = 2 * PIPE_MOVE_SECONDS + PIPE_UP_SECONDS;

function pipe(enemy, seconds) {
  enemy.timer += seconds;
  while (enemy.timer >= enemy.downSeconds + PIPE_UP_CYCLE) {
    enemy.timer -= enemy.downSeconds + PIPE_UP_CYCLE;
    enemy.cycle++;
    enemy.downSeconds = pipeDownSeconds(enemy);
  }
  enemy.y = pipeY(enemy);
}

function pipeY(enemy) {
  return enemy.homeY + PIPE_RISE - pipeRaise(enemy.timer - enemy.downSeconds);
}

export function onScreen(enemy, cameraX) {
  return cameraX !== undefined && enemy.x >= cameraX && enemy.x <= cameraX + SCREEN_WIDTH;
}

export function pointerWarning(enemy) {
  return enemy.charge >= POINTER_PERIOD - POINTER_WARNING_SECONDS;
}

function shotY(enemy) {
  return enemy.homeY - TILE / 2;
}

function shotOrigin(enemy) {
  return enemy.homeX - enemy.width / 2 - SHOT_LENGTH;
}

function shotBlocked(enemy, level, x) {
  return shotOrigin(enemy) - x > SHOT_RANGE || isSolid(tileAt(level, Math.floor(x / TILE), Math.floor(shotY(enemy) / TILE)));
}

function pointer(enemy, level, seconds, cameraX) {
  const moved = enemy.shots.map(x => x - SHOT_SPEED * seconds);
  enemy.shots = moved.filter(x => !shotBlocked(enemy, level, x));
  if (!onScreen(enemy, cameraX)) return;
  enemy.charge += seconds;
  if (enemy.charge >= POINTER_PERIOD) {
    enemy.charge -= POINTER_PERIOD;
    enemy.shots = enemy.shots.concat([shotOrigin(enemy)]);
  }
}

export function leakCycleSeconds(extent) {
  return (extent * TILE) / LEAK_GROW_SPEED + LEAK_FULL_SECONDS + (extent * TILE) / LEAK_SHRINK_SPEED + LEAK_EMPTY_SECONDS;
}

export function puddleLength(seconds, extent) {
  const full = extent * TILE;
  let t = seconds % leakCycleSeconds(extent);
  if (t < full / LEAK_GROW_SPEED) return t * LEAK_GROW_SPEED;
  t -= full / LEAK_GROW_SPEED;
  if (t < LEAK_FULL_SECONDS) return full;
  t -= LEAK_FULL_SECONDS;
  return Math.max(full - t * LEAK_SHRINK_SPEED, 0);
}

function leak(enemy, seconds, cameraX) {
  if (onScreen(enemy, cameraX)) enemy.seen = true;
  if (!enemy.seen) return;
  enemy.timer += seconds;
  enemy.grown = puddleLength(enemy.timer, enemy.extent);
}

function forkSpeed(enemy) {
  if (!enemy.small) return BUG_SPEED;
  return enemy.grace > 0 ? SPLIT_DASH_SPEED : SMALL_FORK_SPEED;
}

export function stepEnemies(enemies, level, hero, seconds, cameraX) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.time += seconds;
    enemy.grace = Math.max(enemy.grace - seconds, 0);
    enemy.previousY = enemy.y;
    if (enemy.kind === "bug") walk(enemy, level, enemies, BUG_SPEED, seconds);
    else if (enemy.kind === "fork") walk(enemy, level, enemies, forkSpeed(enemy), seconds);
    else if (enemy.kind === "zombie") drift(enemy, level, enemies, seconds);
    else if (enemy.kind === "ping") hop(enemy);
    else if (enemy.kind === "hang") hang(enemy, level, hero, seconds);
    else if (enemy.kind === "pipe") pipe(enemy, seconds);
    else if (enemy.kind === "pointer") pointer(enemy, level, seconds, cameraX);
    else if (enemy.kind === "leak") leak(enemy, seconds, cameraX);
  }
}

export function stompable(enemy) {
  return KILLABLE.indexOf(enemy.kind) >= 0;
}

function heroBox(hero) {
  return { left: hero.x - HERO_WIDTH / 2, right: hero.x + HERO_WIDTH / 2, top: hero.y - heroHeight(hero), bottom: hero.y };
}

function hitBox(enemy) {
  const b = box(enemy, enemy.x);
  return { left: b.left + HIT_INSET, right: b.right - HIT_INSET, top: b.top + HIT_INSET, bottom: b.bottom };
}

function cronColumn(enemy) {
  return { left: enemy.x - enemy.width / 2, right: enemy.x + enemy.width / 2, top: enemy.homeY - enemy.columnTiles * TILE, bottom: enemy.homeY };
}

function shotBox(enemy, x) {
  const y = shotY(enemy);
  return { left: x, right: x + SHOT_LENGTH, top: y - SHOT_HEIGHT / 2, bottom: y + SHOT_HEIGHT / 2 };
}

function puddleBox(enemy) {
  const right = enemy.x - TILE / 2;
  return { left: right - enemy.grown, right, top: enemy.homeY - PUDDLE_HEIGHT, bottom: enemy.homeY };
}

export function harmfulAreas(enemy) {
  if (enemy.kind === "cron") return cronState(enemy) === "firing" ? [cronColumn(enemy)] : [];
  if (enemy.kind === "pointer") return [hitBox(enemy)].concat(enemy.shots.map(x => shotBox(enemy, x)));
  if (enemy.kind === "leak" && enemy.grown > 0) return [hitBox(enemy), puddleBox(enemy)];
  return [hitBox(enemy)];
}

function split(enemies, fork) {
  for (const child of enemies) {
    if (child.parent !== fork.id) continue;
    child.alive = true;
    child.homeX = fork.x;
    resetEnemy(child);
    child.grace = SPLIT_GRACE_SECONDS;
    child.ghost = true;
  }
}

export function touchEnemies(enemies, hero, previousBottom) {
  const events = [];
  const heroArea = heroBox(hero);
  let stomped = false;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (enemy.ghost) {
      if (hero.grounded && !overlaps(heroArea, hitBox(enemy))) enemy.ghost = false;
      continue;
    }
    const touched = harmfulAreas(enemy).filter(area => overlaps(heroArea, area));
    if (touched.length === 0) continue;
    const onBody = overlaps(heroArea, hitBox(enemy));
    const fromAbove = previousBottom <= enemy.previousY - enemy.height + STOMP_TOLERANCE;
    if (onBody && fromAbove && stompable(enemy)) {
      enemy.alive = false;
      stomped = true;
      events.push({ type: "kill", source: enemy.kind, small: enemy.small, x: enemy.x, y: enemy.y - enemy.height });
      if (enemy.kind === "fork" && !enemy.small) split(enemies, enemy);
    } else {
      events.push({ type: "hit", source: enemy.kind });
    }
  }
  if (stomped) {
    hero.vy = -STOMP_BOUNCE_VELOCITY;
    hero.jumping = true;
    hero.grounded = false;
  }
  return events;
}
