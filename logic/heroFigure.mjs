import { TILE } from "./screen.mjs";
import { WALK_SPEED, isSolid } from "./physics.mjs";
import { tileAt } from "./level.mjs";

export const FIDGET_AFTER_SECONDS = 3;
export const LAND_SECONDS = 0.12;
export const SIZE_CHANGE_SECONDS = 0.7;
export const SIZE_FLICKER_SECONDS = 0.09;
export const BLINK_EVERY_SECONDS = 3;
export const BLINK_SECONDS = 0.14;
export const SKID_SPEED = 90;
export const DEATH_FREEZE_SECONDS = 0.3;
export const DEATH_SCATTER_SECONDS = 0.9;
export const PART_COUNT = 9;

const FAR_LEG_OPACITY = 0.85;
const FAR_ARM_OPACITY = 0.55;
const STROKE = "┃";
const THICKNESS = 1.9;
const GLITCH_GLYPHS = "▓▒░#%&$!?";
const GLITCH_HEIGHT = 7;

const SIZES = {
  small: { leg: 7, torso: 6, head: 15, arm: 5, width: 1.15 },
  big: { leg: 15, torso: 13, head: 21, arm: 9, width: 1.4 },
};

const WALK_CYCLE = [
  { legs: 0.7, seconds: 0.14 },
  { legs: 0.2, seconds: 0.1 },
  { legs: -0.7, seconds: 0.14 },
  { legs: -0.2, seconds: 0.1 },
];

const RUN_CYCLE = [
  { legs: 1.15, seconds: 0.13 },
  { legs: 0.3, seconds: 0.06 },
  { legs: -1.15, seconds: 0.13 },
  { legs: -0.3, seconds: 0.06 },
];

export function createHeroAnimator(hero) {
  return { time: 0, idle: 0, sinceLanding: LAND_SECONDS, facing: 1, wasGrounded: hero.grounded, wasBig: hero.big, sizeChange: null };
}

export function stepHeroAnimator(animator, hero, direction, seconds) {
  animator.time += seconds;
  if (direction !== 0) animator.facing = direction;
  const still = hero.grounded && direction === 0 && Math.abs(hero.vx) < 5;
  animator.idle = still ? animator.idle + seconds : 0;
  animator.sinceLanding = hero.grounded && !animator.wasGrounded ? 0 : animator.sinceLanding + seconds;
  animator.wasGrounded = hero.grounded;
  if (hero.big !== animator.wasBig) animator.sizeChange = { toBig: hero.big, age: 0 };
  else if (animator.sizeChange) {
    animator.sizeChange.age += seconds;
    if (animator.sizeChange.age >= SIZE_CHANGE_SECONDS) animator.sizeChange = null;
  }
  animator.wasBig = hero.big;
}

export function shownBig(animator, hero) {
  const change = animator.sizeChange;
  if (!change) return hero.big;
  const flick = Math.floor(change.age / SIZE_FLICKER_SECONDS) % 2 === 0;
  return change.toBig ? !flick : flick;
}

export function underCeiling(hero, level) {
  const row = Math.floor((hero.y - 1) / TILE) - 1;
  const first = Math.floor((hero.x - 8) / TILE);
  const last = Math.floor((hero.x + 8 - 1e-6) / TILE);
  for (let col = first; col <= last; col++) if (isSolid(tileAt(level, col, row))) return true;
  return false;
}

export function heroState(animator, hero, level, direction) {
  if (!hero.grounded) {
    if (hero.vy < -120) return "jump";
    return hero.vy < 120 ? "peak" : "fall";
  }
  if (animator.sinceLanding < LAND_SECONDS) return "land";
  if (!hero.big && underCeiling(hero, level)) return "duck";
  if (direction !== 0 && Math.sign(hero.vx) === -direction && Math.abs(hero.vx) > SKID_SPEED) return "skid";
  if (Math.abs(hero.vx) > WALK_SPEED + 0.5) return "run";
  if (Math.abs(hero.vx) > 5) return "walk";
  return animator.idle > FIDGET_AFTER_SECONDS ? "fidget" : "idle";
}

function cycleFrame(time, cycle) {
  let total = 0;
  for (const frame of cycle) total += frame.seconds;
  let left = time % total;
  for (let i = 0; i < cycle.length; i++) {
    if (left < cycle[i].seconds) return i;
    left -= cycle[i].seconds;
  }
  return cycle.length - 1;
}

function face(time, dead) {
  if (dead) return "×";
  return time % BLINK_EVERY_SECONDS > BLINK_EVERY_SECONDS - BLINK_SECONDS ? "-" : "@";
}

export function heroPose(state, time) {
  const pose = { legs: [0.12, -0.12], arms: [0.15, -0.15], lean: 0, bob: 0, scaleX: 1, scaleY: 1, face: face(time, false), crouch: false, torsoScale: 1, fidget: false };
  if (state === "idle") {
    pose.bob = Math.floor(time * 1.5) % 2 ? 0.5 : 0;
  } else if (state === "fidget") {
    const tap = Math.floor(time * 7) % 2;
    pose.legs = [1.45, 1.3];
    pose.crouch = true;
    pose.arms = tap ? [1.25, 1.5] : [1.5, 1.25];
    pose.fidget = true;
  } else if (state === "walk" || state === "victory") {
    const frame = cycleFrame(time * (state === "victory" ? 0.7 : 1), WALK_CYCLE);
    const stride = WALK_CYCLE[frame].legs;
    pose.legs = [stride, -stride];
    pose.arms = [0.5 - stride * 0.5, 0.5 + stride * 0.5];
    pose.bob = frame % 2 ? -0.5 : 0;
    if (state === "victory") pose.arms = [Math.floor(time * 4) % 2 ? 2.85 : 3.15, stride * 0.8];
  } else if (state === "run") {
    const frame = cycleFrame(time, RUN_CYCLE);
    const stride = RUN_CYCLE[frame].legs;
    pose.legs = [stride, -stride];
    pose.arms = [1.3 - stride * 0.6, 1.3 + stride * 0.6];
    pose.lean = 0.2;
    pose.bob = frame % 2 ? -1 : 0;
  } else if (state === "jump") {
    pose.legs = [0.75, -0.15];
    pose.arms = [2.6, 2.2];
    pose.scaleX = 0.92;
    pose.scaleY = 1.1;
  } else if (state === "peak") {
    pose.legs = [0.45, -0.35];
    pose.arms = [1.7, -1.7];
  } else if (state === "fall") {
    const flap = Math.floor(time * 10) % 2;
    pose.legs = [0.2, -0.45];
    pose.arms = flap ? [2.5, -2.3] : [2.3, -2.5];
    pose.scaleY = 1.04;
  } else if (state === "land") {
    pose.legs = [0.6, -0.6];
    pose.arms = [0.6, -0.6];
    pose.scaleX = 1.28;
    pose.scaleY = 0.72;
  } else if (state === "skid") {
    pose.legs = [0.75, 0.35];
    pose.arms = [-0.9, -0.5];
    pose.lean = -0.3;
  } else if (state === "duck") {
    const shuffle = Math.floor(time * 6) % 2;
    pose.legs = [1.05, -1.05];
    pose.crouch = true;
    pose.torsoScale = 0.6;
    pose.arms = shuffle ? [0.7, -0.5] : [0.5, -0.7];
  } else if (state === "dead") {
    pose.legs = [0.5, -0.5];
    pose.arms = [2.4, -2.4];
    pose.face = face(time, true);
  }
  return pose;
}

function limb(start, angle, length) {
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  return {
    mid: { x: start.x + dx * length / 2, y: start.y + dy * length / 2 },
    end: { x: start.x + dx * length, y: start.y + dy * length },
    rotation: -angle,
  };
}

function part(text, x, y, height, extra) {
  return Object.assign({ text, measure: text, x, y, height, width: 0, rotation: 0, scaleX: 1, role: "hero", opacity: 1 }, extra || {});
}

function limbPart(l, length, extra) {
  return part(STROKE, l.mid.x, l.mid.y, length + 1, Object.assign({ rotation: l.rotation, scaleX: THICKNESS }, extra || {}));
}

function hidden() {
  return part("", 0, 0, 0, { opacity: 0 });
}

function mirrored(p, facing) {
  return Object.assign({}, p, { x: p.x * facing, rotation: p.rotation * facing });
}

export function heroParts(pose, big, facing, time, speed) {
  const size = big ? SIZES.big : SIZES.small;
  const w = size.width;
  const legRise = pose.crouch ? size.leg * Math.cos(Math.abs(pose.legs[0])) : size.leg;
  const torso = size.torso * pose.torsoScale;
  const hip = { x: 0, y: -legRise + pose.bob };
  const shoulder = { x: 0, y: hip.y - torso };
  const headY = shoulder.y - size.head * 0.55;
  const legs = pose.legs.map(angle => limb(hip, angle, size.leg));
  const arms = pose.arms.map(angle => limb({ x: 0, y: shoulder.y + 1 }, angle, size.arm));
  const scarfLength = Math.min(3, 1 + Math.floor(speed / 100));
  const scarfWave = Math.floor(time * 8) % 2;
  const scarf = "~".repeat(scarfLength);
  const parts = [
    part(scarf, -(4 + scarfLength * 2.2) * w, shoulder.y - 1 + scarfWave, 0, { width: scarfLength * 4.5 * w, role: "heroAccent", opacity: 0.85 }),
    limbPart(legs[1], size.leg, { opacity: FAR_LEG_OPACITY }),
    limbPart(arms[1], size.arm, { opacity: FAR_ARM_OPACITY, scaleX: THICKNESS * 0.8 }),
    part(STROKE, 0, (hip.y + shoulder.y) / 2, torso + 1, { scaleX: THICKNESS * 1.2 }),
    limbPart(legs[0], size.leg),
    limbPart(arms[0], size.arm),
    part(pose.face, 0, headY, size.head, { measure: "@" }),
    big ? part("#", 5 * w, (hip.y + shoulder.y) / 2, 6 * w, { role: "heroAccent" }) : hidden(),
    pose.fidget
      ? part(facing > 0 ? "┛" : "┗", size.leg * 0.75, hip.y - 3 * w, 7 * w, { scaleX: 1.4, role: "heroAccent", opacity: Math.floor(time * 5) % 3 === 0 ? 0.65 : 1 })
      : hidden(),
  ];
  return parts.map(p => mirrored(p, facing));
}

export function deathParts(parts, age) {
  if (age < DEATH_FREEZE_SECONDS) return parts;
  const spread = Math.min((age - DEATH_FREEZE_SECONDS) / DEATH_SCATTER_SECONDS, 1);
  return parts.map((p, i) => {
    const angle = i * 2.399;
    const moved = Object.assign({}, p, {
      x: p.x + Math.cos(angle) * spread * 2.2 * (6 + (i % 3) * 4),
      y: p.y + Math.sin(angle) * spread * 2.2 * (6 + (i % 4) * 3) - spread * 13,
      rotation: p.rotation + spread * 4.4 * (i % 2 ? 1 : -1),
      opacity: p.opacity * (1 - spread),
    });
    if (spread <= 0.15 || p.text === "") return moved;
    const glyph = GLITCH_GLYPHS[(i + Math.floor(age * 20)) % GLITCH_GLYPHS.length];
    return Object.assign(moved, { text: glyph, measure: glyph, height: GLITCH_HEIGHT, width: 0, scaleX: 1 });
  });
}
