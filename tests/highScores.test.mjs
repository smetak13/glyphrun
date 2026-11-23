import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SCORES, insertScore, parseScores, scoreEntry, stageLabel } from "../logic/highScores.mjs";

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
