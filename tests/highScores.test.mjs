import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SCORES, insertScore, insertTime, parseScores, parseTimes, runTime, scoreEntry, stageLabel, timeEntry } from "../logic/highScores.mjs";

function entry(score) {
  return { score, seed: 0x7f3a91c2, level: 2, won: false, date: "2026-11-23" };
}

function tableOf(scores) {
  return scores.map(entry);
}

test("a score goes in by score, highest first", () => {
  const result = insertScore(tableOf([900, 500, 100]), entry(600));

  assert.deepEqual(result.scores.map(e => e.score), [900, 600, 500, 100]);
  assert.equal(result.rank, 2);
});

test("a score equal to one in the table goes below it", () => {
  const newer = Object.assign(entry(500), { date: "2026-11-24" });

  const result = insertScore(tableOf([900, 500, 100]), newer);

  assert.equal(result.rank, 3);
  assert.equal(result.scores[2].date, "2026-11-24");
});

test("the table keeps only the top ten", () => {
  const full = tableOf([1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]);

  const result = insertScore(full, entry(450));

  assert.equal(result.scores.length, MAX_SCORES);
  assert.equal(result.rank, 7);
  assert.equal(result.scores[MAX_SCORES - 1].score, 200);
});

test("a score below a full table is not entered", () => {
  const full = tableOf([1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]);

  const result = insertScore(full, entry(100));

  assert.equal(result.rank, 0);
  assert.equal(result.scores, full);
});

test("a run that scored nothing is not entered", () => {
  assert.equal(insertScore([], entry(0)).rank, 0);
});

test("stored scores are read back, and broken storage gives an empty table", () => {
  const table = tableOf([900, 100]);

  assert.deepEqual(parseScores(JSON.stringify(table)), table);
  assert.deepEqual(parseScores("not json"), []);
  assert.deepEqual(parseScores("{}"), []);
  assert.deepEqual(parseScores(JSON.stringify([{ score: "lots" }, entry(5)])), [entry(5)]);
});

test("an entry records the run's score, seed, level reached, win and date", () => {
  const run = { score: 4200, seed: 42, levelNumber: 6, won: true };

  assert.deepEqual(scoreEntry(run, "2026-11-23"), { score: 4200, seed: 42, level: 6, won: true, date: "2026-11-23" });
});

test("the level reached reads as the level, BOSS or WIN", () => {
  assert.equal(stageLabel(entry(1)), "2/5");
  assert.equal(stageLabel(Object.assign(entry(1), { level: 6 })), "BOSS");
  assert.equal(stageLabel(Object.assign(entry(1), { level: 6, won: true })), "WIN");
});

function timed(seconds) {
  return { seconds, seed: 0x7f3a91c2, date: "2026-11-23" };
}

function timesOf(list) {
  return list.map(timed);
}

test("a time goes in by time, fastest first", () => {
  const result = insertTime(timesOf([250, 300, 400]), timed(280));

  assert.deepEqual(result.times.map(e => e.seconds), [250, 280, 300, 400]);
  assert.equal(result.rank, 2);
});

test("a time equal to one in the table goes below it", () => {
  const newer = Object.assign(timed(300), { date: "2026-11-24" });

  const result = insertTime(timesOf([250, 300, 400]), newer);

  assert.equal(result.rank, 3);
  assert.equal(result.times[2].date, "2026-11-24");
});

test("the time table keeps only the ten fastest", () => {
  const full = timesOf([100, 110, 120, 130, 140, 150, 160, 170, 180, 190]);

  const slower = insertTime(full, timed(200));
  const faster = insertTime(full, timed(105));

  assert.equal(slower.rank, 0);
  assert.equal(slower.times, full);
  assert.equal(faster.rank, 2);
  assert.equal(faster.times.length, MAX_SCORES);
  assert.equal(faster.times[MAX_SCORES - 1].seconds, 180);
});

test("stored times are read back, and broken storage gives an empty table", () => {
  const table = timesOf([250, 300]);

  assert.deepEqual(parseTimes(JSON.stringify(table)), table);
  assert.deepEqual(parseTimes("not json"), []);
  assert.deepEqual(parseTimes(JSON.stringify([{ seconds: "fast" }, timed(5)])), [timed(5)]);
});

test("a time entry records the run's playing time over its levels, seed and date", () => {
  const run = { seed: 42, stats: { seconds: 200.5 }, world: { time: 81.25 } };

  assert.deepEqual(timeEntry(run, "2026-11-24"), { seconds: 281.75, seed: 42, date: "2026-11-24" });
});

test("a run time shows minutes, seconds and hundredths", () => {
  assert.equal(runTime(281.326), "4:41.33");
  assert.equal(runTime(59.996), "1:00.00");
  assert.equal(runTime(3725.5), "1:02:05.50");
});
