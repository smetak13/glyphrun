import { TILE } from "./screen.mjs";
import { tileAt } from "./level.mjs";
import { isSolid, heroHeight } from "./physics.mjs";
import { harmfulAreas, stompable, defeatEnemy } from "./enemies.mjs";
import { subStream, pick } from "./random.mjs";

export const WEAPON_IDS = ["duck", "breakpoint", "claude", "revert"];
export const WEAPONS = {
  duck: { name: "rubber duck", toast: "apt install rubber-duck", verb: "throw the duck", role: "bit", icon: "●" },
  breakpoint: { name: "breakpoint", toast: "gdb: breakpoint 1 set", verb: "set a breakpoint", role: "cyan", icon: "◉" },
  claude: { name: "claude", toast: "claude: how can I help?", verb: "ask claude", role: "block", icon: "✻" },
  revert: { name: "git revert", toast: "git revert HEAD", verb: "git revert", role: "ground", icon: "↺" },
};

export const HAND_HEIGHT = 14;
export const HAND_REACH = 12;
export const THROW_SECONDS = 0.15;
export const HINT_SECONDS = 4;
export const HINT_AFTER_FIRE_SECONDS = 0.6;

export const DUCK_SPEED = 280;
export const DUCK_LAUNCH_VELOCITY = 60;
export const DUCK_BOUNCE_VELOCITY = 200;
export const DUCK_GRAVITY = 1500;
export const DUCK_SECONDS = 1.4;
export const DUCK_COOLDOWN = 0.25;
export const DUCK_LIMIT = 2;
export const DUCK_RADIUS = 6;

export const BREAKPOINT_SPEED = 260;
export const BREAKPOINT_RANGE = 9 * TILE;
export const BREAKPOINT_COOLDOWN = 1;
export const BREAKPOINT_RADIUS = 5;
export const PAUSE_SECONDS = 3;

export const CLAUDE_THINK_SECONDS = 0.5;
export const CLAUDE_REACH = 7 * TILE;
export const CLAUDE_VERTICAL_REACH = 5 * TILE;
export const CLAUDE_OUT_SPEED = 420;
export const CLAUDE_BACK_SPEED = 480;
export const CLAUDE_COOLDOWN = 0.4;
export const CLAUDE_IDLE_COOLDOWN = 0.6;
export const CLAUDE_SAY_SECONDS = 1.3;
export const CLAUDE_REACHED = 10;
export const CLAUDE_LINES = ["You're absolutely right!", "Fixed it.", "I see the issue.", "Perfect! Bug removed."];
export const CLAUDE_NOTHING = "No issues found.";

export const REVERT_SPEED = 420;
export const REVERT_SLOWDOWN = 600;
export const REVERT_RETURN_SPEED = 460;
export const REVERT_RETURN_ACCELERATION = 900;
export const REVERT_SECONDS = 3;
export const REVERT_COOLDOWN = 0.15;
export const REVERT_RADIUS = 7;
export const REVERT_CATCH = 14;

export function weaponFor(seed) {
  return pick(subStream(seed, "weapon"), WEAPON_IDS);
}

export function createArms() {
  return { cooldown: 0, facing: 1, shots: [], spark: null, throwAge: THROW_SECONDS };
}

export function clearArms(arms) {
  arms.cooldown = 0;
  arms.shots = [];
  arms.spark = null;
}

function handPoint(hero, facing) {
  return { x: hero.x + facing * HAND_REACH, y: hero.y - HAND_HEIGHT };
}

function heroCenterY(hero) {
  return hero.y - heroHeight(hero) / 2;
}

export function sparkHome(hero, facing, time) {
  return { x: hero.x - facing * 14, y: hero.y - 56 + Math.sin(time * 3) * 3 };
}

function solidAt(level, x, y) {
  return isSolid(tileAt(level, Math.floor(x / TILE), Math.floor(y / TILE)));
}

function launch(weapon, hero, facing) {
  const hand = handPoint(hero, facing);
  if (weapon === "duck") return { kind: "duck", x: hand.x, y: hand.y, vx: facing * DUCK_SPEED, vy: -DUCK_LAUNCH_VELOCITY, radius: DUCK_RADIUS, life: DUCK_SECONDS, spin: 0 };
  if (weapon === "breakpoint") return { kind: "breakpoint", x: hand.x, y: hand.y, vx: facing * BREAKPOINT_SPEED, vy: 0, radius: BREAKPOINT_RADIUS, life: BREAKPOINT_RANGE / BREAKPOINT_SPEED, spin: 0 };
  return { kind: "revert", x: hand.x, y: hand.y, vx: facing * REVERT_SPEED, vy: 0, radius: REVERT_RADIUS, life: REVERT_SECONDS, spin: 0, direction: facing, back: false, speed: 0, hit: [] };
}

const LIMITS = { duck: DUCK_LIMIT, breakpoint: 1, revert: 1 };
const COOLDOWNS = { duck: DUCK_COOLDOWN, breakpoint: BREAKPOINT_COOLDOWN, revert: REVERT_COOLDOWN };

function fire(arms, weapon, hero, targets, time) {
  if (weapon === "claude") return askClaude(arms, hero, targets, time);
  if (arms.shots.length >= LIMITS[weapon]) return false;
  arms.shots.push(launch(weapon, hero, arms.facing));
  arms.cooldown = COOLDOWNS[weapon];
  return true;
}

function stepDuck(shot, level, seconds) {
  shot.vy += DUCK_GRAVITY * seconds;
  shot.x += shot.vx * seconds;
  shot.spin += seconds;
  if (solidAt(level, shot.x + Math.sign(shot.vx) * shot.radius, shot.y)) return "fizzle";
  const previousBottom = shot.y + shot.radius;
  shot.y += shot.vy * seconds;
  const bottom = shot.y + shot.radius;
  const row = Math.floor(bottom / TILE);
  const tile = tileAt(level, Math.floor(shot.x / TILE), row);
  if (shot.vy > 0 && (isSolid(tile) || (tile === "=" && previousBottom <= row * TILE + 0.5))) {
    shot.y = row * TILE - shot.radius;
    shot.vy = -DUCK_BOUNCE_VELOCITY;
  }
  if (shot.y - shot.radius > level.rows.length * TILE) return "gone";
  return null;
}

function stepBreakpoint(shot, level, seconds) {
  shot.x += shot.vx * seconds;
  return solidAt(level, shot.x + Math.sign(shot.vx) * shot.radius, shot.y) ? "fizzle" : null;
}

function turnBack(shot) {
  shot.back = true;
  shot.speed = 0;
  shot.hit = [];
}

function stepRevert(shot, level, hero, seconds) {
  shot.spin += seconds * shot.direction;
  if (!shot.back) {
    shot.vx -= shot.direction * REVERT_SLOWDOWN * seconds;
    shot.x += shot.vx * seconds;
    if (shot.vx * shot.direction <= 0 || solidAt(level, shot.x + shot.direction * shot.radius, shot.y)) turnBack(shot);
    return null;
  }
  shot.speed = Math.min(shot.speed + REVERT_RETURN_ACCELERATION * seconds, REVERT_RETURN_SPEED);
  const dx = hero.x - shot.x;
  const dy = hero.y - HAND_HEIGHT - shot.y;
  const distance = Math.hypot(dx, dy);
  if (distance < REVERT_CATCH) return "caught";
  const step = Math.min(shot.speed * seconds, distance);
  shot.x += (dx / distance) * step;
  shot.y += (dy / distance) * step;
  return null;
}

function overlapsShot(shot, area) {
  return shot.x + shot.radius > area.left && shot.x - shot.radius < area.right && shot.y + shot.radius > area.top && shot.y - shot.radius < area.bottom;
}

function areasFor(enemy, pauses) {
  const areas = harmfulAreas(enemy);
  return stompable(enemy) && !pauses ? areas.slice(0, 1) : areas;
}

function live(enemy) {
  return enemy.alive && !enemy.ghost;
}

function centerOf(enemy) {
  return { x: enemy.x, y: enemy.y - enemy.height / 2 };
}

export function pauseEnemy(enemy) {
  enemy.paused = PAUSE_SECONDS;
}

function strike(shot, targets, events) {
  for (const target of targets) {
    for (const enemy of target.enemies) {
      if (!live(enemy) || (shot.hit && shot.hit.indexOf(enemy) >= 0)) continue;
      if (!areasFor(enemy, shot.kind === "breakpoint").some(area => overlapsShot(shot, area))) continue;
      if (shot.kind === "breakpoint") {
        pauseEnemy(enemy);
        events.push({ type: "pause", x: shot.x, y: shot.y });
        return "gone";
      }
      if (!stompable(enemy)) {
        if (shot.kind === "revert") {
          if (!shot.back) turnBack(shot);
          continue;
        }
        return "fizzle";
      }
      events.push(defeatEnemy(target.enemies, enemy));
      if (shot.kind !== "revert") return "gone";
      shot.hit.push(enemy);
    }
  }
  return null;
}

function stepShots(arms, level, hero, targets, seconds, events) {
  const kept = [];
  for (const shot of arms.shots) {
    shot.life -= seconds;
    let end = shot.life <= 0 ? "gone" : null;
    if (!end && shot.kind === "duck") end = stepDuck(shot, level, seconds);
    else if (!end && shot.kind === "breakpoint") end = stepBreakpoint(shot, level, seconds);
    else if (!end) end = stepRevert(shot, level, hero, seconds);
    if (!end) end = strike(shot, targets, events);
    if (end === "fizzle") events.push({ type: "fizzle", x: shot.x, y: shot.y });
    if (end === "caught") arms.cooldown = REVERT_COOLDOWN;
    if (!end) kept.push(shot);
  }
  arms.shots = kept;
}

export function claudeTarget(hero, facing, targets) {
  let best = null;
  let bestDistance = Infinity;
  for (const target of targets) {
    for (const enemy of target.enemies) {
      if (!live(enemy) || !stompable(enemy)) continue;
      const center = centerOf(enemy);
      const ahead = (center.x - hero.x) * facing;
      const rise = Math.abs(center.y - heroCenterY(hero));
      if (ahead <= 0 || ahead > CLAUDE_REACH || rise > CLAUDE_VERTICAL_REACH) continue;
      const distance = Math.hypot(center.x - hero.x, center.y - heroCenterY(hero));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { enemy, enemies: target.enemies };
      }
    }
  }
  return best;
}

function createSpark(hero, facing, time) {
  const home = sparkHome(hero, facing, time);
  return { state: "idle", x: home.x, y: home.y, timer: 0, target: null, line: 0, say: null };
}

function say(spark, text) {
  spark.say = { text, age: 0 };
}

function askClaude(arms, hero, targets, time) {
  if (!arms.spark) arms.spark = createSpark(hero, arms.facing, time);
  const spark = arms.spark;
  if (spark.state !== "idle") return false;
  const target = claudeTarget(hero, arms.facing, targets);
  if (!target) {
    say(spark, CLAUDE_NOTHING);
    arms.cooldown = CLAUDE_IDLE_COOLDOWN;
    return true;
  }
  spark.state = "thinking";
  spark.timer = CLAUDE_THINK_SECONDS;
  spark.target = target;
  return true;
}

function moveSpark(spark, x, y, speed, seconds) {
  const dx = x - spark.x;
  const dy = y - spark.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= Math.max(speed * seconds, CLAUDE_REACHED)) {
    spark.x = x;
    spark.y = y;
    return true;
  }
  spark.x += (dx / distance) * speed * seconds;
  spark.y += (dy / distance) * speed * seconds;
  return false;
}

function stepSpark(arms, hero, seconds, time, events) {
  if (!arms.spark) arms.spark = createSpark(hero, arms.facing, time);
  const spark = arms.spark;
  const home = sparkHome(hero, arms.facing, time);
  if (spark.say) {
    spark.say.age += seconds;
    if (spark.say.age >= CLAUDE_SAY_SECONDS) spark.say = null;
  }
  if (spark.state === "idle" || spark.state === "thinking") {
    const follow = Math.min(1, seconds * 12);
    spark.x += (home.x - spark.x) * follow;
    spark.y += (home.y - spark.y) * follow;
  }
  if (spark.state === "thinking") {
    spark.timer -= seconds;
    if (spark.timer <= 0) spark.state = live(spark.target.enemy) ? "out" : "back";
  } else if (spark.state === "out") {
    const enemy = spark.target.enemy;
    if (!live(enemy)) spark.state = "back";
    else {
      const center = centerOf(enemy);
      if (moveSpark(spark, center.x, center.y, CLAUDE_OUT_SPEED, seconds)) {
        events.push(defeatEnemy(spark.target.enemies, enemy));
        say(spark, CLAUDE_LINES[spark.line % CLAUDE_LINES.length]);
        spark.line++;
        spark.state = "back";
      }
    }
  } else if (spark.state === "back") {
    if (moveSpark(spark, home.x, home.y, CLAUDE_BACK_SPEED, seconds)) {
      spark.state = "idle";
      spark.target = null;
      arms.cooldown = CLAUDE_COOLDOWN;
    }
  }
}

export function stepArms(arms, weapon, hero, level, targets, input, seconds, time) {
  const events = [];
  if (input.direction !== 0) arms.facing = input.direction;
  arms.cooldown = Math.max(arms.cooldown - seconds, 0);
  arms.throwAge += seconds;
  if (!weapon) return events;
  if (input.firePressed && arms.cooldown === 0 && fire(arms, weapon, hero, targets, time)) {
    arms.throwAge = 0;
    events.push({ type: "fire", weapon });
  }
  stepShots(arms, level, hero, targets, seconds, events);
  if (weapon === "claude") stepSpark(arms, hero, seconds, time, events);
  return events;
}

export const GLYPH_POOL = 12;
const SPINNER = "·✢✶✻✽✻✶✢";

function glyph(text, x, y, size, role, extra) {
  return Object.assign({ text, x, y, size, role, rotation: 0, opacity: 1, label: false }, extra || {});
}

function duckGlyphs(x, y, scale, facing) {
  return [
    glyph("●", x - facing * scale, y + scale, 11 * scale, "bit"),
    glyph("●", x + facing * 3.5 * scale, y - 5 * scale, 7 * scale, "bit"),
    glyph(facing > 0 ? "▸" : "◂", x + facing * 7.5 * scale, y - 4.5 * scale, 5 * scale, "hero"),
  ];
}

function heldGlyphs(weapon, x, y, facing) {
  if (weapon === "duck") return duckGlyphs(x, y, 0.9, facing);
  return [glyph(WEAPONS[weapon].icon, x, y, 10, WEAPONS[weapon].role)];
}

function shotGlyphs(shot) {
  if (shot.kind === "duck") return duckGlyphs(shot.x, shot.y, 1, Math.sign(shot.vx) || 1);
  if (shot.kind === "breakpoint") {
    const back = -Math.sign(shot.vx);
    const trail = [1, 2, 3].map(i => glyph("·", shot.x + back * i * 7, shot.y, 8, "cyan", { opacity: 0.5 - i * 0.12 }));
    return trail.concat([glyph("◉", shot.x, shot.y, 13, "cyan")]);
  }
  return [glyph("↺", shot.x, shot.y, 17, "ground", { rotation: shot.spin * 14 * 180 / Math.PI })];
}

function sparkGlyphs(spark, time) {
  const thinking = spark.state === "thinking";
  const flying = spark.state === "out" || spark.state === "back";
  const text = thinking ? SPINNER[Math.floor(time * 12) % SPINNER.length] : "✻";
  const glyphs = [glyph(text, spark.x, spark.y, flying ? 16 : 14, "block", { rotation: thinking ? 0 : Math.sin(time * 2) * 17 })];
  if (thinking) glyphs.push(glyph("Thinking…", spark.x, spark.y - 14, 10, "block", { label: true }));
  else if (spark.say) glyphs.push(glyph(spark.say.text, spark.x, spark.y - 14, 10, "text", { label: true, opacity: Math.min(1, (CLAUDE_SAY_SECONDS - spark.say.age) / 0.3) }));
  return glyphs;
}

export function weaponGlyphs(world, hand, facing, time) {
  const weapon = world.weapon;
  if (!weapon) return [];
  const arms = world.arms;
  let glyphs = [];
  const thrown = weapon === "revert" && arms.shots.length > 0;
  if (hand && weapon !== "claude" && !thrown) glyphs = glyphs.concat(heldGlyphs(weapon, hand.x + facing * 3, hand.y, facing));
  for (const shot of arms.shots) glyphs = glyphs.concat(shotGlyphs(shot));
  if (weapon === "claude" && arms.spark) glyphs = glyphs.concat(sparkGlyphs(arms.spark, time));
  return glyphs.slice(0, GLYPH_POOL);
}

export function iconGlyphs(weapon, scale) {
  if (weapon === "duck") return duckGlyphs(0, 0, scale, 1);
  return [glyph(WEAPONS[weapon].icon, 0, 0, 12 * scale, WEAPONS[weapon].role)];
}
