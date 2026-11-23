import { TILE, SCREEN_HEIGHT } from "./screen.mjs";
import { tileAt } from "./level.mjs";
import { isSolid, heroHeight, HERO_WIDTH } from "./physics.mjs";

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
};

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
    alive: true,
  };
  resetEnemy(enemy);
  return enemy;
}

export function resetEnemy(enemy) {
  enemy.x = enemy.homeX;
  enemy.y = enemy.homeY;
  enemy.previousY = enemy.y;
  enemy.direction = -1;
  enemy.time = 0;
  enemy.state = enemy.kind === "hang" ? "hanging" : "moving";
  enemy.vy = 0;
  enemy.lying = 0;
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
    if (supports(tileAt(level, col, row))) return row * TILE;
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

export function stepEnemies(enemies, level, hero, seconds) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.time += seconds;
    enemy.previousY = enemy.y;
    if (enemy.kind === "bug") walk(enemy, level, enemies, BUG_SPEED, seconds);
    else if (enemy.kind === "zombie") drift(enemy, level, enemies, seconds);
    else if (enemy.kind === "ping") hop(enemy);
    else if (enemy.kind === "hang") hang(enemy, level, hero, seconds);
  }
}

export function stompable(enemy) {
  return enemy.kind !== "spikes";
}

function heroBox(hero) {
  return { left: hero.x - HERO_WIDTH / 2, right: hero.x + HERO_WIDTH / 2, top: hero.y - heroHeight(hero), bottom: hero.y };
}

function hitBox(enemy) {
  const b = box(enemy, enemy.x);
  return { left: b.left + HIT_INSET, right: b.right - HIT_INSET, top: b.top + HIT_INSET, bottom: b.bottom };
}

export function touchEnemies(enemies, hero, previousBottom) {
  const events = [];
  const heroArea = heroBox(hero);
  let stomped = false;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const area = hitBox(enemy);
    if (!overlaps(heroArea, area)) continue;
    const fromAbove = previousBottom <= enemy.previousY - enemy.height + STOMP_TOLERANCE;
    if (fromAbove && stompable(enemy)) {
      enemy.alive = false;
      stomped = true;
      events.push({ type: "kill", source: enemy.kind, x: enemy.x, y: enemy.y - enemy.height });
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
