import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUTTON_RECOLOR_AT,
  COMMIT_MESSAGES,
  ENDING_AT,
  HERO_END_X,
  HERO_START_X,
  INTRO_TEXT,
  LEVELS,
  SHIPPED_CHARS_PER_SECOND,
  SHIPPED_PAUSE_SECONDS,
  SHIPPED_TEXT,
  SHIPPED_TYPED_SECONDS,
  TIPS,
  bootLog,
  clockTime,
  commitHash,
  commitMessage,
  fireworks,
  gameOverTip,
  introDone,
  introShown,
  shippedShown,
  sparkAt,
  victoryScene,
} from "../logic/story.mjs";

const STATS = { kills: 47, zombies: 5, hits: 3, deaths: 2, seconds: 0 };

test("there is a title card for each of the five levels", () => {
  assert.equal(LEVELS.length, 5);
  assert.equal(LEVELS[4].title, "deploy --prod");
});

test("the intro types itself and is done a moment after the last character", () => {
  const typed = INTRO_TEXT.length / 30;

  assert.equal(introShown(0), "");
  assert.equal(introShown(typed), INTRO_TEXT);
  assert.equal(introDone(typed), false);
  assert.equal(introDone(typed + 1.2), true);
});

test("the boot log reports the run's real statistics and closes the ticket with the run's time", () => {
  const log = bootLog(STATS, 312, 7 * 60 + 5.8);

  assert.deepEqual(log, [
    "[  OK  ] Started button-colour.service",
    "[  OK  ] Resolved 47 bugs (3 were features)",
    "[  OK  ] Reaped 5 zombie processes",
    "[  OK  ] Recovered from 2 core dumps",
    "[  OK  ] Collected 312 bits",
    "[  OK  ] Closed TICKET-1337 (estimate: 5 min, actual: 7:05)",
  ]);
});

test("the boot log speaks of one thing in the singular", () => {
  const log = bootLog({ kills: 1, zombies: 1, hits: 1, deaths: 1, seconds: 0 }, 1, 400);

  assert.equal(log[1], "[  OK  ] Resolved 1 bug (1 was a feature)");
  assert.equal(log[2], "[  OK  ] Reaped 1 zombie process");
  assert.equal(log[3], "[  OK  ] Recovered from 1 core dump");
  assert.equal(log[4], "[  OK  ] Collected 1 bit");
});

test("a run under the estimate is suspicious", () => {
  const log = bootLog(STATS, 0, 4 * 60 + 41);

  assert.equal(log[5], "[  OK  ] Closed TICKET-1337 (estimate: 5 min, actual: 4:41 · under estimate. suspicious.)");
});

test("a run of an hour or more shows hours in its time", () => {
  assert.equal(clockTime(3600 + 7 * 60 + 12.9), "1:07:12");
  assert.equal(clockTime(59), "0:59");
});

test("the deploy before the boss types itself and pauses after shipping", () => {
  const shipped = SHIPPED_TEXT.indexOf("Shipped.\n") + "Shipped.\n".length;
  const atShipped = shipped / SHIPPED_CHARS_PER_SECOND;

  assert.equal(shippedShown(atShipped + 0.2), shippedShown(atShipped + SHIPPED_PAUSE_SECONDS - 0.05));
  assert.ok(shippedShown(atShipped + SHIPPED_PAUSE_SECONDS + 0.2).length > shippedShown(atShipped).length);
  assert.equal(shippedShown(SHIPPED_TYPED_SECONDS), SHIPPED_TEXT);
});

test("the story mentions Friday only on level 5's title card", () => {
  const texts = [INTRO_TEXT, SHIPPED_TEXT, LEVELS[0].subtitle, LEVELS[3].subtitle].concat(TIPS, COMMIT_MESSAGES, bootLog(STATS, 0, 0));

  assert.ok(texts.every(text => text.indexOf("Friday") < 0));
  assert.equal(LEVELS[4].subtitle, "Friday, 16:58.");
});

test("commit messages, hashes and tips come from the seed", () => {
  assert.equal(commitMessage(7, 2), commitMessage(7, 2));
  assert.ok(COMMIT_MESSAGES.indexOf(commitMessage(7, 2)) >= 0);
  assert.match(commitHash(7, 2), /^[0-9a-f]{7}$/);
  assert.equal(commitHash(7, 2), commitHash(7, 2));
  assert.notEqual(commitHash(7, 2), commitHash(7, 3));
  assert.ok(TIPS.indexOf(gameOverTip(7, 3)) >= 0);
});

test("the victory walks the hero to the sign, then the button changes colour", () => {
  assert.equal(victoryScene(0).heroX, HERO_START_X);
  assert.equal(victoryScene(0).button, false);
  assert.equal(victoryScene(ENDING_AT).heroX, HERO_END_X);
  assert.equal(victoryScene(BUTTON_RECOLOR_AT - 0.01).buttonRecolored, false);
  assert.equal(victoryScene(BUTTON_RECOLOR_AT).buttonRecolored, true);
  assert.equal(victoryScene(ENDING_AT - 0.01).ending, false);
  assert.equal(victoryScene(ENDING_AT).ending, true);
});

test("fireworks are the same for a seed, made of 0 and 1, and fade out", () => {
  const sparks = fireworks(7);

  assert.deepEqual(sparks, fireworks(7));
  assert.ok(sparks.every(spark => spark.text === "0" || spark.text === "1"));
  assert.equal(sparkAt(sparks[0], sparks[0].delay - 0.1), null);
  assert.equal(sparkAt(sparks[0], sparks[0].delay).opacity, 1);
  assert.equal(sparkAt(sparks[0], sparks[0].delay + 5), null);
});
