import { test } from "node:test";
import assert from "node:assert/strict";
import { levelStyle, sharesMood, styleFamilies } from "../logic/style.mjs";

const SEEDS = [1, 2, 0x7f3a91c2, 0xdeadbeef, 12345, 99, 4242, 0xffffffff];

function terrainSample(terrain) {
  const looks = [];
  for (let x = 0; x < 40; x++) looks.push(terrain.fill(x, 20, 1 + (x % 4)));
  return looks;
}

test("the same seed and level always get the same style", () => {
  const a = levelStyle(0x7f3a91c2, 3);
  const b = levelStyle(0x7f3a91c2, 3);

  assert.equal(a.terrain.name, b.terrain.name);
  assert.deepEqual(terrainSample(a.terrain), terrainSample(b.terrain));
  assert.deepEqual(a.backdrop, b.backdrop);
});

test("the levels of a run, the boss arena included, never repeat a terrain or a background", () => {
  for (const seed of SEEDS) {
    const families = [1, 2, 3, 4, 5, 6].map(n => styleFamilies(seed, n));
    assert.equal(new Set(families.map(f => f.terrain.name)).size, 6);
    assert.equal(new Set(families.map(f => f.backdrop.name)).size, 6);
  }
});

test("a level's background shares a mood with its terrain", () => {
  for (const seed of SEEDS) {
    for (let n = 1; n <= 6; n++) {
      const families = styleFamilies(seed, n);
      assert.ok(sharesMood(families.terrain, families.backdrop), families.terrain.name + " " + families.backdrop.name);
    }
  }
});

test("different seeds give different looks", () => {
  const firstLevels = new Set();
  for (let seed = 1; seed <= 40; seed++) firstLevels.add(styleFamilies(seed, 1).terrain.name + "/" + styleFamilies(seed, 1).backdrop.name);

  assert.ok(firstLevels.size >= 25);
});
