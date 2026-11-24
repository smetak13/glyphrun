import { SCREEN_WIDTH, TILE } from "./screen.mjs";
import { PING_GROUND_SECONDS, PING_AIR_SECONDS, pointerWarning } from "./enemies.mjs";

export const DEATH_SECONDS = 0.4;
export const ZOMBIE_DEATH_SECONDS = 0.5;
export const FORK_TEAR_SECONDS = 0.15;
export const SQUASH_SHARE = 0.35;
export const GLITCH_EVERY_SECONDS = 3.1;
export const GLITCH_SECONDS = 0.09;
export const BLINK_SECONDS = 0.14;
export const LAND_SQUASH_SECONDS = 0.12;
export const PING_RING_SECONDS = 0.45;
export const COLUMN_ROW_HEIGHT = 12;
export const PUDDLE_CELL = 6;
export const DRAW_MARGIN = 12 * TILE;

const MAIN_ROLE = {
  bug: "hostile", zombie: "hostileAlt2", spikes: "hostile", ping: "hostileAlt", hang: "hostileAlt", cron: "hostile",
  pipe: "hostile", pointer: "hostileAlt", fork: "hostileAlt2", leak: "hostileAlt2", spinlock: "hostileAlt",
};
const SECOND_RED = { hostile: "hostileAlt", hostileAlt: "hostile", hostileAlt2: "hostile" };
const CREATURES = ["bug", "zombie", "ping", "hang", "fork", "leak"];
const GLITCH_SEEDS = { bug: 0, zombie: 1.3, ping: 2.1, hang: 0.7, fork: 1.8, leak: 2.6 };
const GLITCH_GLYPHS = "▓▒░#%&$!?";
const HEX = "0x7f3a9cde";
const EYE_TILT = 0.35;
const SPIKE_PITCH = 9;
const SPINLOCK_SPACING = 14;
const PIVOT_RISE = TILE / 2;

export function mainRole(kind) {
  return MAIN_ROLE[kind];
}

export function accentRole(kind) {
  return SECOND_RED[MAIN_ROLE[kind]];
}

function part(text, x, y, height, role, extra) {
  return Object.assign({ text, measure: text, x, y, height, width: 0, rotation: 0, scaleX: 1, role, opacity: 1, fixed: false }, extra || {});
}

function widePart(text, x, y, width, role, extra) {
  return part(text, x, y, 0, role, Object.assign({ width }, extra || {}));
}

function boxPart(text, x, y, width, height, role, extra) {
  return part(text, x, y, height, role, Object.assign({ width }, extra || {}));
}

function hidden() {
  return part("", 0, 0, 0, "hostile", { opacity: 0 });
}

function blinking(time, period, seed) {
  return (time + seed) % period > period - BLINK_SECONDS;
}

function eye(x, y, size, time, period, seed, tilt) {
  const rotation = tilt === undefined ? (x < 0 ? EYE_TILT : x > 0 ? -EYE_TILT : 0) : tilt;
  if (blinking(time, period, seed)) return boxPart("▁", x, y + size * 0.3, size * 1.3, size * 0.35, "text", { rotation });
  return boxPart("▀", x, y, size * 1.5, size * 0.45, "text", { rotation });
}

function wideEye(x, y, size) {
  return boxPart("█", x, y, size * 0.8, size * 0.9, "text");
}

function bugParts(enemy, time) {
  const main = mainRole("bug"), accent = accentRole("bug");
  const scurry = enemy.dropping ? Math.floor(time * 20) % 2 : Math.floor(time * 12) % 2;
  return {
    scaleY: 1 + Math.sin(time * 3) * 0.04,
    parts: [
      part("╱", 11.5, -17.5, 6, accent, { rotation: Math.sin(time * 6) * 0.15, opacity: 0.85 }),
      part("ж", -3, -8.5, 17, main, { scaleX: scurry ? 0.8 : 1 }),
      part("◆", 7, -11, 11, main),
      enemy.dropping ? wideEye(9, -12, 4.5) : eye(9, -12, 3.6, time, 2.6, 0, -EYE_TILT),
    ],
  };
}

function zombieParts(enemy, time) {
  const main = mainRole("zombie");
  const flicker = Math.floor(time * 9) % 23 === 0 ? 0.45 : 1;
  const sway = Math.sin(time * 3) * 0.12;
  const shut = blinking(time, 3.3, 0.4);
  const eyeAt = x => shut
    ? widePart("-", x, -14.5, 3.4, "text", { fixed: true })
    : part("×", x, -14.5, 3.6, "text", { fixed: true });
  return {
    parts: [
      boxPart(Math.floor(time * 6) % 2 ? "░" : "▒", 0, 1, 12, 4, main, { opacity: 0.4 }),
      widePart("─", 11, -15, 8, main, { rotation: sway, opacity: 0.9 }),
      widePart("─", 10, -11, 7, main, { rotation: -sway, opacity: 0.55 }),
      part("Z", 0, -11, 20, main, { opacity: flicker, fixed: true }),
      eyeAt(-4.6),
      eyeAt(-0.6),
    ],
  };
}

export function pingTiming(enemy) {
  const cycle = PING_GROUND_SECONDS + PING_AIR_SECONDS;
  const sinceLanding = (((enemy.time + enemy.phase) % cycle) + cycle) % cycle;
  return { sinceLanding, airborne: sinceLanding > PING_GROUND_SECONDS };
}

function pingParts(enemy, time) {
  const main = mainRole("ping"), accent = accentRole("ping");
  const { sinceLanding, airborne } = pingTiming(enemy);
  const squash = !airborne && sinceLanding < LAND_SQUASH_SECONDS ? 1 - sinceLanding / LAND_SQUASH_SECONDS : 0;
  const ring = !airborne && sinceLanding < PING_RING_SECONDS ? sinceLanding / PING_RING_SECONDS : null;
  const ringPart = (text, side) => ring === null
    ? hidden()
    : part(text, side * (9 + ring * 12), -5, 7 + ring * 5, accent, { opacity: 0.9 * (1 - ring), fixed: true });
  return {
    scaleX: 1 + 0.3 * squash - (airborne ? 0.06 : 0),
    scaleY: 1 - 0.3 * squash + (airborne ? 0.08 : 0),
    parts: [
      part("◎", 0, -9, 18, main),
      eye(-3.4, -10, 3, time, 3.1, 0.7),
      eye(3.4, -10, 3, time, 3.1, 0.7),
      ringPart("⟨", -1),
      ringPart("⟩", 1),
    ],
  };
}

function hangParts(enemy, time) {
  const main = mainRole("hang"), accent = accentRole("hang"), state = enemy.state;
  const curl = Math.sin(time * 2.2) * 0.2;
  const fixed = { fixed: true };
  let legs;
  if (state === "falling") legs = [part("╲", -11, -18, 9, accent, fixed), part("╱", 11, -18, 9, accent, fixed)];
  else if (state === "lying") legs = [widePart("─", -11, -2, 7, accent, fixed), widePart("─", 11, -2, 7, accent, fixed)];
  else if (state === "winding") legs = [part("╱", -7, -9, 6, accent, fixed), part("╲", 7, -9, 6, accent, fixed)];
  else legs = [part("╱", -11, -9, 9, accent, { rotation: curl, fixed: true }), part("╲", 11, -9, 9, accent, { rotation: -curl, fixed: true })];
  let eyes;
  if (state === "falling") eyes = [wideEye(-4, -14, 4.5), wideEye(4, -14, 4.5)];
  else if (state === "lying") eyes = [part("×", -4, -14, 3.6, "text"), part("×", 4, -14, 3.6, "text")];
  else eyes = [eye(-4, -14, 3.2, time, 2.9, 0.3), eye(4, -14, 3.2, time, 2.9, 0.3)];
  const lying = state === "lying";
  const swaying = state === "hanging" || state === "winding";
  return {
    rotation: swaying ? Math.sin(time * 1.4) * 0.08 : 0,
    pivotY: -18,
    scaleX: lying ? 1.15 : 1,
    scaleY: lying ? 0.8 : 1,
    parts: legs.concat([part("▼", 0, -9.5, 18, main)], eyes),
  };
}

export function spikeCount(enemy) {
  return Math.round(enemy.width / SPIKE_PITCH);
}

function spikesParts(enemy, time) {
  const main = mainRole("spikes"), accent = accentRole("spikes");
  const count = spikeCount(enemy), pitch = enemy.width / count;
  const glint = Math.floor(time * 10) % (count * 6);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const lit = i === glint;
    parts.push(boxPart("^", -enemy.width / 2 + pitch * (i + 0.5), -enemy.height / 2, pitch * 0.85, enemy.height, lit || i % 2 ? accent : main,
      { opacity: lit ? 1 : 0.9, fixed: true }));
  }
  return { parts };
}

function cronParts(enemy, time) {
  const main = mainRole("cron"), accent = accentRole("cron");
  return {
    parts: [
      part("[", -8, -5.5, 11, accent, { fixed: true }),
      part("]", 8, -5.5, 11, accent, { fixed: true }),
      part("*", 0, -5.5, 8, main, { rotation: time * 1.8, fixed: true }),
    ],
  };
}

function pipeParts(enemy, time) {
  const main = mainRole("pipe"), accent = accentRole("pipe");
  return {
    parts: [
      boxPart("┃", 0, -11, 4, 22, accent, { opacity: 0.55, fixed: true }),
      boxPart("}", -6.5, -28.5, 11, 15, main, { rotation: Math.sin(time * 7) * 0.15, fixed: true }),
      boxPart("<", 6, -28.5, 12, 15, main, { fixed: true }),
    ],
  };
}

function pointerParts(enemy, time) {
  const main = mainRole("pointer"), accent = accentRole("pointer");
  const warning = pointerWarning(enemy);
  const faint = warning && Math.floor(time * 8) % 2 === 1;
  return {
    parts: [
      boxPart("▁", 0, -1, 12, 2, accent, { fixed: true }),
      part("‹", -8.5, -7, 7, accent, { fixed: true }),
      part("*", 0, -7, warning ? 12.5 : 11, main, { rotation: time * (warning ? 14 : 1.5), opacity: faint ? 0.3 : 1, fixed: true }),
    ],
  };
}

function forkParts(enemy, time) {
  const main = mainRole("fork"), k = enemy.small ? 0.75 : 1;
  const step = Math.floor(time * (enemy.small ? 14 : 9)) % 2;
  return {
    opacity: enemy.ghost ? 0.45 : 1,
    parts: [
      part("&", 0, -9 * k, 18 * k, main, { rotation: step ? 0.12 : -0.12, fixed: true }),
      eye(-0.6 * k, -14 * k, 3 * k, time, 2.8, 1.1),
      eye(3 * k, -14 * k, 3 * k, time, 2.8, 1.1),
    ],
  };
}

function leakParts(enemy, time) {
  const main = mainRole("leak"), accent = accentRole("leak");
  const shut = blinking(time, 3.4, 1.7);
  const drip = (time * 1.3) % 1;
  const pupil = (x, y) => shut ? hidden() : part("▪", x, y, 2.8, "text", { fixed: true });
  return {
    parts: [
      part("%", 0, -8, 16, main, { fixed: true }),
      part(".", -9.5, -13 + drip * 12, 3, accent, { opacity: 1 - drip * 0.6, fixed: true }),
      pupil(-3.3, -12),
      pupil(3.3, -3.8),
    ],
  };
}

function spinlockParts(enemy, time) {
  const main = mainRole("spinlock"), accent = accentRole("spinlock");
  const center = -PIVOT_RISE;
  const angle = time * 2.1;
  const parts = [
    part("(", -8.5, center, 13, accent, { fixed: true }),
    part(")", 8.5, center, 13, accent, { fixed: true }),
    part("o", 0, center, 8, main, { fixed: true }),
    part("•", Math.cos(angle) * 3.2, center - Math.sin(angle) * 3.2, 2.2, accent, { fixed: true }),
  ];
  const linkCount = enemy.arm * (enemy.double ? 2 : 1);
  for (let i = 0; i < linkCount; i++) {
    const link = enemy.links[i];
    const tip = i % enemy.arm === enemy.arm - 1;
    if (!link || link.buried) parts.push(hidden());
    else if (tip) parts.push(part("✶", link.x - enemy.x, link.y - enemy.y, 10, main, { rotation: time * 5, fixed: true }));
    else parts.push(part("●", link.x - enemy.x, link.y - enemy.y, 8, (i % enemy.arm) % 2 ? accent : main, { opacity: 0.9, fixed: true }));
  }
  return { parts };
}

const BODIES = {
  bug: bugParts, zombie: zombieParts, ping: pingParts, hang: hangParts, spikes: spikesParts, cron: cronParts,
  pipe: pipeParts, pointer: pointerParts, fork: forkParts, leak: leakParts, spinlock: spinlockParts,
};

function creature(kind) {
  return CREATURES.indexOf(kind) >= 0;
}

export function partCount(enemy) {
  return BODIES[enemy.kind](enemy, 0).parts.length + (creature(enemy.kind) ? 1 : 0);
}

export function facingOf(enemy) {
  return enemy.kind === "bug" || enemy.kind === "zombie" || enemy.kind === "fork" ? enemy.direction : 1;
}

export function glitching(kind, time, effects) {
  return effects && creature(kind) && (time + GLITCH_SEEDS[kind]) % GLITCH_EVERY_SECONDS < GLITCH_SECONDS;
}

function mirrored(p, facing) {
  if (p.fixed || facing > 0) return p;
  return Object.assign({}, p, { x: -p.x, rotation: -p.rotation });
}

export function drawnNear(enemy, cameraX) {
  const margin = enemy.kind === "pointer" ? SCREEN_WIDTH : DRAW_MARGIN;
  return enemy.x > cameraX - margin && enemy.x < cameraX + SCREEN_WIDTH + margin;
}

export function enemyFigure(enemy, time, effects) {
  const body = BODIES[enemy.kind](enemy, time);
  const facing = facingOf(enemy);
  const tick = glitching(enemy.kind, time, effects);
  let parts = body.parts.map(p => mirrored(p, facing));
  if (tick) parts = parts.map((p, i) => Object.assign({}, p, { x: p.x + (i % 2 ? 1.5 : -1.5) }));
  if (creature(enemy.kind)) {
    const main = parts.find(p => p.role === mainRole(enemy.kind) && p.height >= 13) || parts[0];
    parts.push(tick ? Object.assign({}, main, { x: main.x + 2, role: "cyan", opacity: main.opacity * 0.5 }) : hidden());
  }
  return {
    parts,
    scaleX: body.scaleX || 1,
    scaleY: body.scaleY || 1,
    rotation: body.rotation || 0,
    pivotY: body.pivotY || 0,
    opacity: body.opacity === undefined ? 1 : body.opacity,
    rise: 0,
  };
}

export function deathSeconds(enemy) {
  if (enemy.kind === "zombie") return ZOMBIE_DEATH_SECONDS;
  if (enemy.kind === "fork" && !enemy.small) return FORK_TEAR_SECONDS;
  return DEATH_SECONDS;
}

export function deathFigure(enemy, time, age) {
  const figure = enemyFigure(enemy, time, false);
  const progress = Math.min(age / deathSeconds(enemy), 1);
  if (enemy.kind === "zombie") {
    return Object.assign(figure, {
      rise: 26 * progress,
      opacity: figure.opacity * (1 - progress),
      scaleX: figure.scaleX * (1 - 0.3 * progress),
      scaleY: figure.scaleY * (1 + 0.3 * progress),
    });
  }
  if (enemy.kind === "fork" && !enemy.small) {
    return Object.assign(figure, { scaleX: figure.scaleX * (1 + 1.4 * progress), scaleY: figure.scaleY * (1 - 0.3 * progress) });
  }
  const squash = Math.min(progress / SQUASH_SHARE, 1);
  figure.scaleX *= 1 + 0.5 * squash;
  figure.scaleY *= 1 - 0.65 * squash;
  if (progress <= SQUASH_SHARE) return figure;
  const scatter = (progress - SQUASH_SHARE) / (1 - SQUASH_SHARE);
  figure.parts = figure.parts.map((p, i) => {
    if (p.text === "") return p;
    const angle = i * 2.399;
    const moved = Object.assign({}, p, {
      x: p.x + Math.cos(angle) * scatter * 14,
      y: p.y + Math.sin(angle) * scatter * 10 - scatter * 8,
      rotation: p.rotation + scatter * (i % 2 ? 3 : -3),
      opacity: p.opacity * (1 - scatter),
    });
    if (scatter <= 0.15) return moved;
    const glyph = GLITCH_GLYPHS[(i + Math.floor(age * 20)) % GLITCH_GLYPHS.length];
    return Object.assign(moved, { text: glyph, measure: glyph });
  });
  return figure;
}

export function deathSparks(enemy, age) {
  const progress = Math.min(age / deathSeconds(enemy), 1);
  if (progress <= SQUASH_SHARE || enemy.kind === "zombie" || (enemy.kind === "fork" && !enemy.small)) return [];
  const scatter = (progress - SQUASH_SHARE) / (1 - SQUASH_SHARE);
  const sparks = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2, reach = 6 + scatter * 18;
    sparks.push({ text: HEX[(i + Math.floor(age * 15)) % HEX.length], x: Math.cos(angle) * reach, y: -8 + Math.sin(angle) * reach, opacity: 1 - scatter, role: accentRole(enemy.kind) });
  }
  return sparks;
}

export function createEnemyAnimator(enemies) {
  return { time: 0, alive: enemies.map(enemy => enemy.alive), bossBugs: [], deaths: [] };
}

export function stepEnemyAnimator(animator, enemies, seconds, bossBugs) {
  animator.time += seconds;
  for (const death of animator.deaths) death.age += seconds;
  animator.deaths = animator.deaths.filter(death => death.age < deathSeconds(death.enemy) && (death.id === null || !enemies[death.id].alive));
  enemies.forEach((enemy, id) => {
    if (animator.alive[id] && !enemy.alive) animator.deaths.push({ id, age: 0, enemy: snapshot(enemy) });
    animator.alive[id] = enemy.alive;
  });
  for (const bug of animator.bossBugs) if (!bug.alive) animator.deaths.push({ id: null, age: 0, enemy: snapshot(bug) });
  animator.bossBugs = (bossBugs || []).slice();
}

function snapshot(enemy) {
  return Object.assign({}, enemy, { state: enemy.kind === "hang" ? "lying" : enemy.state, links: enemy.links.slice() });
}

export function bossDeaths(animator) {
  return animator.deaths.filter(death => death.id === null);
}

export function deathOf(animator, id) {
  for (const death of animator.deaths) if (death.id === id) return death;
  return null;
}

export function puddleShown(enemy, age) {
  if (age === null) return enemy.grown;
  return enemy.grown * Math.max(1 - age / DEATH_SECONDS, 0);
}

export function puddleParts(extent, time) {
  const width = extent * TILE;
  const cells = Math.ceil(width / PUDDLE_CELL);
  const wave = Math.floor(time * 6);
  let surface = "";
  for (let i = cells - 1; i >= 0; i--) surface += (i + wave) % 3 ? "~" : "≈";
  const main = mainRole("leak");
  return [
    boxPart("▄".repeat(cells), 0, -1.5, width, 3, main, { opacity: 0.5 }),
    boxPart(surface, 0, -4.5, width, 3, main),
  ];
}

export function columnRows(enemy) {
  return enemy.columnTiles * 2;
}

export function columnParts(enemy, time) {
  const main = mainRole("cron"), accent = accentRole("cron");
  const scroll = Math.floor(time * 16);
  const rows = columnRows(enemy);
  const parts = [];
  for (let row = 0; row < rows; row++) {
    parts.push(boxPart("#", Math.sin(row * 1.7 + time * 23) * 1.2, -(row + 0.5) * COLUMN_ROW_HEIGHT, enemy.width, COLUMN_ROW_HEIGHT - 1,
      (row + scroll) % 2 ? main : accent, { opacity: row === rows - 1 ? 0.8 : 1 }));
  }
  return parts;
}

export function shotParts(left, centerY, time) {
  const main = mainRole("pointer"), accent = accentRole("pointer");
  return [
    boxPart("<", left + 4, centerY, 8, 7, main),
    boxPart("--", left + 16.5, centerY, 15, 2.5, accent, { opacity: Math.floor(time * 12) % 2 ? 0.6 : 0.85 }),
  ];
}
