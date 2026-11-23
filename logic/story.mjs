import { pick, randomInt, subStream } from "./random.mjs";

export const LEVELS = [
  { title: "git init", subtitle: "Everything compiles. Suspicious." },
  { title: "make", subtitle: "14,000 warnings. Ignoring them." },
  { title: "npm install", subtitle: "Downloading half of the internet." },
  { title: "staging", subtitle: "Works on my machine." },
  { title: "deploy --prod", subtitle: "Friday, 16:58." },
];

export const TAGLINE = "one small change. five minutes, tops.";
export const TICKET = "TICKET-1337";
export const ESTIMATE_SECONDS = 5 * 60;

export const INTRO_TEXT = [
  "$ cat " + TICKET + ".md",
  "# Change the button colour",
  "priority: low",
  "estimate: 5 min",
  "",
  "$ git checkout -b quick-fix",
].join("\n");
export const TYPING_CHARS_PER_SECOND = 30;
export const INTRO_HOLD_SECONDS = 1.2;
export const TITLE_SECONDS = 2.8;

const SHIPPED_BEFORE_PAUSE = [
  "$ git diff --stat",
  " button.css | 2 +-",
  " 1 file changed, 1 insertion(+), 1 deletion(-)",
  "",
  "$ deploy --prod",
  "Deploying to production... done.",
  "[  OK  ] Shipped.",
  "",
  "",
].join("\n");
export const SHIPPED_PAUSE_SECONDS = 1;
export const SHIPPED_CHARS_PER_SECOND = 70;
export const SHIPPED_TEXT = SHIPPED_BEFORE_PAUSE + [
  "$ uptime",
  " 16:59:58 up 0 min, 1 user",
  "",
  "[    0.000000] Kernel panic - not syncing: Fatal exception",
  "[    0.000001] ---[ end Kernel panic ]---",
].join("\n");

export const COMMIT_MESSAGES = [
  "fix bugs (hopefully)",
  "remove console.log",
  "it works, don't touch it",
  "wip",
  "fix typo",
  "refactor everything",
  "temporary fix (permanent)",
  "make the linter happy",
  "revert \"revert \\\"fix\\\"\"",
  "add tests (later)",
  "update dependencies, pray",
  "final final v2",
  "quick fix (3rd attempt)",
  "almost done",
];

export const TIPS = [
  "Tip: have you tried turning it off and on again?",
  "Tip: it's not a bug, it's a feature.",
  "Tip: works on my machine.",
  "Tip: read the error message. Then read it again.",
  "Tip: a stomp is just a very assertive code review.",
  "Tip: sudo makes you bigger, not wiser.",
  "Tip: watch the rhythm. Cron jobs are punctual.",
];

export const CLOSING_LINE = "$ logout";
export const BUILD_PASSED = "BUILD PASSED · 0 errors · 0 warnings";

export const BOOT_LINE_SECONDS = 0.45;
export const WALK_START = 3.4;
export const WALK_END = 6.4;
export const HERO_START_X = 120;
export const HERO_END_X = 660;
export const SIGN_X = 720;
export const FIREWORKS_START = 5.6;
export const BUILD_PASSED_AT = 7;
export const BUTTON_AT = 8.6;
export const BUTTON_RECOLOR_AT = 9.8;
export const ENDING_AT = 11.8;

const FIREWORK_BURSTS = 5;
const FIREWORK_SPARKS = 14;
const FIREWORK_SECONDS = 1.6;
const FIREWORK_GRAVITY = 160;

function typedLength(seconds, charsPerSecond) {
  return Math.floor(seconds * charsPerSecond);
}

export function introShown(seconds) {
  return INTRO_TEXT.slice(0, typedLength(seconds, TYPING_CHARS_PER_SECOND));
}

export function introDone(seconds) {
  return seconds >= INTRO_TEXT.length / TYPING_CHARS_PER_SECOND + INTRO_HOLD_SECONDS;
}

export const SHIPPED_TYPED_SECONDS = SHIPPED_TEXT.length / SHIPPED_CHARS_PER_SECOND + SHIPPED_PAUSE_SECONDS;

export function shippedShown(seconds) {
  const beforePause = SHIPPED_BEFORE_PAUSE.length / SHIPPED_CHARS_PER_SECOND;
  const typing = seconds < beforePause ? seconds : Math.max(seconds - SHIPPED_PAUSE_SECONDS, beforePause);
  return SHIPPED_TEXT.slice(0, typedLength(typing, SHIPPED_CHARS_PER_SECOND));
}

export function commitMessage(seed, levelNumber) {
  return pick(subStream(seed, "commit " + levelNumber), COMMIT_MESSAGES);
}

export function commitHash(seed, levelNumber) {
  const random = subStream(seed, "commit hash " + levelNumber);
  let hash = "";
  for (let i = 0; i < 7; i++) hash += randomInt(random, 0, 15).toString(16);
  return hash;
}

export function gameOverTip(seed, score) {
  return pick(subStream(seed, "tip " + score), TIPS);
}

function counted(count, singular, plural) {
  return count + " " + (count === 1 ? singular : plural);
}

export function clockTime(seconds) {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const rest = String(whole % 60).padStart(2, "0");
  return hours > 0 ? hours + ":" + String(minutes).padStart(2, "0") + ":" + rest : minutes + ":" + rest;
}

function ticketLine(seconds) {
  const actual = "actual: " + clockTime(seconds) + (seconds < ESTIMATE_SECONDS ? " · under estimate. suspicious." : "");
  return "[  OK  ] Closed " + TICKET + " (estimate: 5 min, " + actual + ")";
}

export function bootLog(stats, bits, seconds) {
  const features = stats.hits === 1 ? "1 was a feature" : stats.hits + " were features";
  return [
    "[  OK  ] Started button-colour.service",
    "[  OK  ] Resolved " + counted(stats.kills, "bug", "bugs") + " (" + features + ")",
    "[  OK  ] Reaped " + counted(stats.zombies, "zombie process", "zombie processes"),
    "[  OK  ] Recovered from " + counted(stats.deaths, "core dump", "core dumps"),
    "[  OK  ] Collected " + counted(bits, "bit", "bits"),
    ticketLine(seconds),
  ];
}

export function victoryScene(seconds) {
  const walk = Math.min(Math.max((seconds - WALK_START) / (WALK_END - WALK_START), 0), 1);
  return {
    bootLines: Math.floor(seconds / BOOT_LINE_SECONDS) + 1,
    walking: seconds >= WALK_START,
    heroX: HERO_START_X + (HERO_END_X - HERO_START_X) * walk,
    buildPassed: seconds >= BUILD_PASSED_AT,
    button: seconds >= BUTTON_AT,
    buttonRecolored: seconds >= BUTTON_RECOLOR_AT,
    ending: seconds >= ENDING_AT,
  };
}

export function fireworks(seed) {
  const random = subStream(seed, "fireworks");
  const sparks = [];
  for (let burst = 0; burst < FIREWORK_BURSTS; burst++) {
    const x = SIGN_X - 200 + random.next() * 360;
    const y = 120 + random.next() * 140;
    const delay = FIREWORKS_START + burst * 0.45;
    for (let i = 0; i < FIREWORK_SPARKS; i++) {
      const angle = (i / FIREWORK_SPARKS) * 2 * Math.PI + random.next() * 0.3;
      const speed = 70 + random.next() * 70;
      sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, delay, text: random.next() < 0.5 ? "0" : "1" });
    }
  }
  return sparks;
}

export function sparkAt(spark, seconds) {
  const age = seconds - spark.delay;
  if (age < 0 || age > FIREWORK_SECONDS) return null;
  return {
    x: spark.x + spark.vx * age,
    y: spark.y + spark.vy * age + FIREWORK_GRAVITY * age * age / 2,
    opacity: 1 - age / FIREWORK_SECONDS,
  };
}
