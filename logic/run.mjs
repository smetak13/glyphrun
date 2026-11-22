import { TILE } from "./screen.mjs";
import { createWorld, respawnHero, stepWorld } from "./world.mjs";
import { EVENTS, hitMessage, killMessage } from "./messages.mjs";
import { ALREADY_ROOT_POINTS, BIT_POINTS, SUDO_POINTS, killPoints, timeBonus } from "./score.mjs";

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
    cause: null,
    timeBonus: 0,
    toast: null,
    popups: [],
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
  run.toast = null;
  run.popups = [];
}

export function nextLevel(run, level) {
  run.bitsBeforeLevel += run.world.bitsCollected;
  run.levelNumber++;
  startLevel(run, level, run.world.hero.big);
}

export function runBits(run) {
  return run.bitsBeforeLevel + run.world.bitsCollected;
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
  run.lives--;
  run.dying = DEATH_SECONDS;
  run.invulnerable = 0;
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
    hero.big = false;
    run.invulnerable = INVULNERABLE_SECONDS;
    showToast(run, hitMessage(source), "hostile");
  } else {
    loseLife(run, source);
  }
}

export function killEnemy(run, source, x, y, small) {
  addPopup(run, x, y, killPoints(source, small), killMessage(source, small), "hostile");
}

function collectBit(run, bit) {
  const x = (bit.col + 0.5) * TILE;
  const y = bit.row * TILE;
  const hero = run.world.hero;
  if (!bit.sudo) {
    addPopup(run, x, y, BIT_POINTS, "", "bit");
  } else if (hero.big) {
    addPopup(run, x, y, ALREADY_ROOT_POINTS, "", "hero");
    showToast(run, EVENTS.alreadyRoot, "hero");
  } else {
    hero.big = true;
    addPopup(run, x, y, SUDO_POINTS, "", "hero");
    showToast(run, EVENTS.sudo, "hero");
  }
}

function handleEvent(run, event) {
  if (event.type === "bit") collectBit(run, event.bit);
  else if (event.type === "checkpoint") showToast(run, EVENTS.checkpoint, "cyan");
  else if (event.type === "exit") {
    run.timeBonus = timeBonus(run.world.time);
    run.score += run.timeBonus;
  } else if (event.type === "pit") {
    loseLife(run, "pit");
  } else if (event.type === "hit") {
    hitHero(run, event.source);
  } else if (event.type === "kill") {
    killEnemy(run, event.source, event.x, event.y, false);
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
  if (run.lives === 0) run.over = true;
  else respawnHero(run.world);
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
