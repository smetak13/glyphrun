import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_EPOCH, addDays, currentStreak, dailySeed, dayNumber, dayRecord, emptyDaily, endAttempt, groupDigits,
  parseDaily, shareLine, shownDays, startAttempt, timeLeft, utcDay,
} from "../logic/daily.mjs";

const DAY = "2026-12-01";

function at(isoTime) {
  return Date.parse(isoTime);
}

function result(score, won) {
  return { score, seconds: 281.32, won };
}

function played(days) {
  return days.reduce((daily, day) => endAttempt(startAttempt(daily, day), day, result(100, false)), emptyDaily());
}

test("the day is the UTC date, whatever the local time zone", () => {
  assert.equal(utcDay(at("2026-11-30T23:30:00-05:00")), "2026-12-01");
  assert.equal(utcDay(at("2026-12-01T00:30:00+01:00")), "2026-11-30");
});

test("the release day is daily #1 and each day after it counts up", () => {
  assert.equal(dayNumber(DAILY_EPOCH), 1);
  assert.equal(dayNumber(addDays(DAILY_EPOCH, 41)), 42);
});

test("the daily seed is the same for the same day and differs between days", () => {
  assert.equal(dailySeed(DAY), dailySeed("2026-12-01"));
  assert.notEqual(dailySeed(DAY), dailySeed(addDays(DAY, 1)));
  assert.ok(Number.isInteger(dailySeed(DAY)) && dailySeed(DAY) >= 0 && dailySeed(DAY) < 0x100000000);
});

test("the time left counts down to UTC midnight in hours and minutes", () => {
  assert.equal(timeLeft(at("2026-12-01T17:07:30Z")), "6h 52m left");
  assert.equal(timeLeft(at("2026-12-01T23:07:59Z")), "52m left");
  assert.equal(timeLeft(at("2026-12-01T23:59:30Z")), "<1m left");
  assert.equal(timeLeft(at("2026-12-01T00:00:00Z")), "24h 0m left");
});

test("high scores show today and the six days before it, newest first", () => {
  const days = shownDays(DAY);

  assert.equal(days.length, 7);
  assert.equal(days[0], DAY);
  assert.equal(days[6], "2026-11-25");
});

test("high scores never show days before daily #1", () => {
  assert.deepEqual(shownDays(addDays(DAILY_EPOCH, 1)), [addDays(DAILY_EPOCH, 1), DAILY_EPOCH]);
});

test("every started attempt counts as a try, ended or not", () => {
  const daily = startAttempt(startAttempt(emptyDaily(), DAY), DAY);

  assert.deepEqual(dayRecord(daily, DAY), { tries: 2, best: null });
});

test("an ended run becomes the result, game over included", () => {
  const daily = endAttempt(startAttempt(emptyDaily(), DAY), DAY, result(0, false));

  assert.deepEqual(dayRecord(daily, DAY).best, result(0, false));
});

test("the result is the best-scoring run of the day", () => {
  let daily = endAttempt(startAttempt(emptyDaily(), DAY), DAY, result(500, false));
  daily = endAttempt(startAttempt(daily, DAY), DAY, result(900, true));
  daily = endAttempt(startAttempt(daily, DAY), DAY, result(700, true));

  assert.equal(dayRecord(daily, DAY).best.score, 900);
  assert.equal(dayRecord(daily, DAY).tries, 3);
});

test("an equal score keeps the older run", () => {
  let daily = endAttempt(startAttempt(emptyDaily(), DAY), DAY, result(500, false));
  daily = endAttempt(startAttempt(daily, DAY), DAY, result(500, true));

  assert.equal(dayRecord(daily, DAY).best.won, false);
});

test("a run started yesterday still counts for yesterday when it ends today", () => {
  const yesterday = addDays(DAY, -1);
  let daily = startAttempt(emptyDaily(), yesterday);
  daily = startAttempt(daily, DAY);

  daily = endAttempt(daily, yesterday, result(300, false));

  assert.equal(dayRecord(daily, yesterday).best.score, 300);
  assert.equal(dayRecord(daily, DAY).best, null);
});

test("only the last seven days are kept", () => {
  const daily = played(["2026-11-24", "2026-11-25", DAY]);

  assert.deepEqual(Object.keys(daily.days).sort(), ["2026-11-25", DAY]);
});

test("the streak counts consecutive days with an ended run", () => {
  const daily = played(["2026-11-28", "2026-11-29", "2026-11-30", DAY]);

  assert.equal(currentStreak(daily, DAY), 4);
});

test("an abandoned run does not extend the streak", () => {
  const daily = startAttempt(played(["2026-11-30"]), DAY);

  assert.equal(currentStreak(daily, addDays(DAY, 1)), 0);
});

test("the streak holds through today until the day ends without a run", () => {
  const daily = played(["2026-11-29", "2026-11-30"]);

  assert.equal(currentStreak(daily, DAY), 2);
  assert.equal(currentStreak(daily, addDays(DAY, 1)), 0);
});

test("the streak starts over after a missed day", () => {
  const daily = played(["2026-11-27", "2026-11-28", "2026-11-30", DAY]);

  assert.equal(currentStreak(daily, DAY), 2);
});

test("ending several runs on one day counts the day once", () => {
  const daily = played(["2026-11-30", DAY, DAY, DAY]);

  assert.equal(currentStreak(daily, DAY), 2);
});

test("a late run of yesterday does not set the streak back", () => {
  let daily = played(["2026-11-30", DAY]);

  daily = endAttempt(daily, "2026-11-30", result(50, false));

  assert.equal(currentStreak(daily, DAY), 2);
});

test("a stored daily record survives a round trip and garbage is ignored", () => {
  const daily = played([DAY]);

  assert.deepEqual(parseDaily(JSON.stringify(daily)), daily);
  assert.deepEqual(parseDaily("not json"), emptyDaily());
  assert.deepEqual(parseDaily("[]"), emptyDaily());
});

test("scores are grouped by thousands", () => {
  assert.equal(groupDigits(12340), "12,340");
  assert.equal(groupDigits(1234567), "1,234,567");
  assert.equal(groupDigits(980), "980");
});

test("the share line marks a run that did not beat the boss as incomplete", () => {
  const day = addDays(DAILY_EPOCH, 2);

  const line = shareLine(day, { tries: 7, best: result(12340, false) });

  assert.equal(line, "glyphrun daily #3 · " + day + " · 12,340 · 4:41.32 (incomplete) · 7 tries · github.com/smetak13/glyphrun");
});

test("the share line of a won run has a plain time and a single try", () => {
  const line = shareLine(DAILY_EPOCH, { tries: 1, best: result(12340, true) });

  assert.equal(line, "glyphrun daily #1 · " + DAILY_EPOCH + " · 12,340 · 4:41.32 · 1 try · github.com/smetak13/glyphrun");
});
