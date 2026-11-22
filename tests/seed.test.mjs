import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSeed } from "../logic/seed.mjs";

test("a seed is shown as two groups of four hex digits", () => {
  assert.equal(formatSeed(0x7f3a91c2), "7f3a-91c2");
});

test("a small seed keeps its leading zeros", () => {
  assert.equal(formatSeed(0x2a), "0000-002a");
});
