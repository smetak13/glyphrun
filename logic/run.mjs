import { TILE } from "./screen.mjs";
import { createWorld, respawnHero, stepWorld } from "./world.mjs";
import { heroHeight } from "./physics.mjs";
import { BOSS_HITS } from "./boss.mjs";
import { EVENTS, bossHitMessage, hitMessage, killMessage } from "./messages.mjs";
import { ALREADY_ROOT_POINTS, BIT_POINTS, BOSS_DEFEATED_POINTS, BOSS_HIT_POINTS, SUDO_POINTS, killPoints, lifeBonus, timeBonus } from "./score.mjs";

export const LIVES = 3;
export const LEVEL_COUNT = 5;
export const INVULNERABLE_SECONDS = 1.5;
export const DEATH_SECONDS = 1.2;
export const TOAST_SECONDS = 2.2;
export const POPUP_SECONDS = 1;

export function createRun(seed, level) {
  const run = {
    seed,
    levelNumber: 1,
    lives: LIVES,
    score: 0,
    bitsBeforeLevel: 0,
    world: null,
    invulnerable: 0,
    dying: 0,
    over: false,
    won: false,
    cause: null,
    stats: { kills: 0, zombies: 0, hits: 0, deaths: 0, seconds: 0 },
    levelPoints: null,
    timeBonus: 0,
    lifeBonus: 0,
    toast: null,
    popups: [],
    cues: [],
  };
  startLevel(run, level, false);
  return run;
}

function startLevel(run, level, big) {
  run.world = createWorld(level);
  run.world.hero.big = big;
  run.invulnerable = 0;
  run.dying = 0;
  run.timeBonus = 0;
  run.levelPoints = { kills: 0, killPoints: 0, sudoPoints: 0 };
  run.toast = null;
  run.popups = [];
}

export function nextLevel(run, level) {
  run.bitsBeforeLevel += run.world.bitsCollected;
  run.stats.seconds += run.world.time;
  run.levelNumber++;
  startLevel(run, level, run.world.hero.big);
}

export function runBits(run) {
  return run.bitsBeforeLevel + run.world.bitsCollected;
}

export function runSeconds(run) {
  return run.stats.seconds + run.world.time;
}

function sudoDetail(points) {
  if (points === ALREADY_ROOT_POINTS) return EVENTS.alreadyRoot;
  return points > 0 ? "granted" : "—";
}

export function levelSummary(run) {
  const points = run.levelPoints;
  const bits = run.world.bitsCollected;
  return [
    { label: "bits", detail: bits + " × " + BIT_POINTS, points: bits * BIT_POINTS },
    { label: "kills", detail: String(points.kills), points: points.killPoints },
    { label: "sudo", detail: sudoDetail(points.sudoPoints), points: points.sudoPoints },
    { label: "time", detail: run.world.time.toFixed(1) + " s", points: run.timeBonus },
  ];
}

function cue(run, name, x, y) {
  run.cues.push({ name, x, y });
}

function heroCue(run, name) {
  const hero = run.world.hero;
  cue(run, name, hero.x, hero.y - heroHeight(hero) / 2);
}

function feetCue(run, name) {
  const hero = run.world.hero;
  cue(run, name, hero.x, hero.y);
}

export function takeCues(run) {
  const cues = run.cues;
  run.cues = [];
  return cues;
}

export function showToast(run, text, role) {
  run.toast = { text, role, age: 0 };
}

function addPopup(run, x, y, points, note, role) {
  run.score += points;
  run.popups.push({ x, y, text: "+" + points, note, role, age: 0 });
}

function inPlay(run) {
  return !run.over && !run.world.finished && run.dying === 0;
}

function loseLife(run, source) {
  run.stats.hits++;
  run.stats.deaths++;
  run.lives--;
  run.dying = DEATH_SECONDS;
  run.invulnerable = 0;
  heroCue(run, "death");
  if (run.lives > 0) {
    showToast(run, hitMessage(source), "hostile");
  } else {
    run.toast = null;
    run.cause = hitMessage(source);
  }
}

export function hitHero(run, source) {
  if (!inPlay(run) || run.invulnerable > 0) return;
  const hero = run.world.hero;
  if (hero.big) {
    run.stats.hits++;
    hero.big = false;
    run.invulnerable = INVULNERABLE_SECONDS;
    heroCue(run, "hit");
    showToast(run, hitMessage(source), "hostile");
  } else {
    loseLife(run, source);
  }
}

export function killEnemy(run, source, x, y, small) {
  const points = killPoints(source, small);
  run.stats.kills++;
  if (source === "zombie") run.stats.zombies++;
  run.levelPoints.kills++;
  run.levelPoints.killPoints += points;
  addPopup(run, x, y, points, killMessage(source, small), "hostile");
  cue(run, "stomp", x, y);
}

function collectBit(run, bit) {
  const x = (bit.col + 0.5) * TILE;
  const y = bit.row * TILE;
  const hero = run.world.hero;
  if (!bit.sudo) {
    addPopup(run, x, y, BIT_POINTS, "", "bit");
    cue(run, "bit", x, y + TILE / 2);
  } else if (hero.big) {
    cue(run, "already-root", x, y + TILE / 2);
    run.levelPoints.sudoPoints += ALREADY_ROOT_POINTS;
    addPopup(run, x, y, ALREADY_ROOT_POINTS, "", "hero");
    showToast(run, EVENTS.alreadyRoot, "hero");
  } else {
    hero.big = true;
    cue(run, "sudo", x, y + TILE / 2);
    run.levelPoints.sudoPoints += SUDO_POINTS;
    addPopup(run, x, y, SUDO_POINTS, "", "hero");
    showToast(run, EVENTS.sudo, "hero");
  }
}

function handleEvent(run, event) {
  if (event.type === "bit") collectBit(run, event.bit);
  else if (event.type === "jump" || event.type === "land") feetCue(run, event.type);
  else if (event.type === "checkpoint") {
    showToast(run, EVENTS.checkpoint, "cyan");
    heroCue(run, "checkpoint");
  } else if (event.type === "exit") {
    heroCue(run, "level-clear");
    run.timeBonus = timeBonus(run.world.time);
    run.score += run.timeBonus;
  } else if (event.type === "pit") {
    loseLife(run, "pit");
  } else if (event.type === "hit") {
    hitHero(run, event.source);
  } else if (event.type === "kill") {
    killEnemy(run, event.source, event.x, event.y, event.small);
  } else if (event.type === "bossHit") {
    addPopup(run, event.x, event.y, BOSS_HIT_POINTS, "", "hostile");
    cue(run, "boss-hit", event.x, event.y);
    showToast(run, bossHitMessage(event.hits, BOSS_HITS), "hostile");
  } else if (event.type === "bossDefeated") {
    const boss = run.world.boss;
    const x = (boss.left + boss.right) / 2;
    const y = boss.ground - 4 * TILE;
    addPopup(run, x, y, BOSS_DEFEATED_POINTS, "", "hostile");
    cue(run, "boss-defeat", x, y);
    showToast(run, EVENTS.bossDefeated, "cyan");
  } else if (event.type === "bossPhase") {
    heroCue(run, "boss-warning");
  } else if (event.type === "coreDump") {
    cue(run, "core-dump", event.x, event.y);
  } else if (event.type === "rebooted") {
    run.won = true;
    run.lifeBonus = lifeBonus(run.lives);
    run.score += run.lifeBonus;
    heroCue(run, "victory");
  }
}

function ageMessages(run, seconds) {
  if (run.toast) {
    run.toast.age += seconds;
    if (run.toast.age >= TOAST_SECONDS) run.toast = null;
  }
  for (const popup of run.popups) popup.age += seconds;
  run.popups = run.popups.filter(popup => popup.age < POPUP_SECONDS);
}

function finishDying(run, seconds) {
  run.dying = Math.max(run.dying - seconds, 0);
  if (run.dying > 0) return;
  if (run.lives === 0) {
    run.over = true;
    heroCue(run, "game-over");
  } else respawnHero(run.world);
}

export function stepRun(run, input, seconds) {
  ageMessages(run, seconds);
  if (run.over || run.world.finished) return;
  if (run.dying > 0) {
    finishDying(run, seconds);
    return;
  }
  run.invulnerable = Math.max(run.invulnerable - seconds, 0);
  for (const event of stepWorld(run.world, input, seconds)) handleEvent(run, event);
}
