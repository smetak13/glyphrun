import { test } from "node:test";
import assert from "node:assert/strict";
import { createRandom, pick, randomInt, shuffle, subStream } from "../logic/random.mjs";

function draws(random, count) {
  const values = [];
  for (let i = 0; i < count; i++) values.push(random.next());
  return values;
}

test("the same seed gives the same sequence", () => {
  assert.deepEqual(draws(createRandom(42), 10), draws(createRandom(42), 10));
});

test("draws are between zero and one", () => {
  const values = draws(createRandom(7), 1000);

  assert.ok(values.every(value => value >= 0 && value < 1));
});

test("a sub-stream is the same for the same seed and label", () => {
  assert.deepEqual(draws(subStream(42, "level-1-attempt-0"), 10), draws(subStream(42, "level-1-attempt-0"), 10));
});

test("sub-streams with different labels or seeds differ", () => {
  const base = draws(subStream(42, "level-1-attempt-0"), 10);

  assert.notDeepEqual(draws(subStream(42, "level-2-attempt-0"), 10), base);
  assert.notDeepEqual(draws(subStream(42, "level-1-attempt-1"), 10), base);
  assert.notDeepEqual(draws(subStream(43, "level-1-attempt-0"), 10), base);
});

test("a random integer stays within its bounds and reaches both", () => {
  const random = createRandom(3);
  const seen = new Set();

  for (let i = 0; i < 1000; i++) seen.add(randomInt(random, 2, 5));

  assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
});

test("pick returns one of the items", () => {
  const random = createRandom(5);

  for (let i = 0; i < 100; i++) assert.ok(["a", "b", "c"].includes(pick(random, ["a", "b", "c"])));
});

test("shuffle returns a permutation and leaves the input alone", () => {
  const items = [1, 2, 3, 4, 5, 6];

  const shuffled = shuffle(createRandom(9), items);

  assert.deepEqual(items, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(shuffled.slice().sort(), items);
});
