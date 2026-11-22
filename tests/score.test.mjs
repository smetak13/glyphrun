import { test } from "node:test";
import assert from "node:assert/strict";
import { killPoints, timeBonus, KILL_POINTS, PAR_SECONDS, TIME_BONUS_PER_SECOND } from "../logic/score.mjs";

test("kills score 100, a small fork bomb 50 and a memory leak 200", () => {
  assert.deepEqual([killPoints("bug", false), killPoints("fork", false), killPoints("fork", true), killPoints("leak", false)], [KILL_POINTS, 100, 50, 200]);
});

test("the time bonus counts whole seconds under par", () => {
  assert.equal(timeBonus(PAR_SECONDS - 10.5), 10 * TIME_BONUS_PER_SECOND);
});

test("there is no time bonus at or over par", () => {
  assert.deepEqual([timeBonus(PAR_SECONDS), timeBonus(PAR_SECONDS + 30)], [0, 0]);
});
