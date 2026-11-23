import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSeed, parseSeed } from "../logic/seed.mjs";

test("a seed is shown as two groups of four hex digits", () => {
  assert.equal(formatSeed(0x7f3a91c2), "7f3a-91c2");
});

test("a small seed keeps its leading zeros", () => {
  assert.equal(formatSeed(0x2a), "0000-002a");
});

test("a seed is parsed from its shown form", () => {
  assert.equal(parseSeed("7f3a-91c2"), 0x7f3a91c2);
});

test("a seed is parsed without the dash, in upper case and with surrounding spaces", () => {
  assert.equal(parseSeed("  7F3A91C2 "), 0x7f3a91c2);
});

test("a seed that is not eight hex digits is rejected", () => {
  for (const text of ["", "7f3a-91c", "7f3a-91c2a", "7f3g-91c2", "7f3a--91c2", "7f-3a91c2"]) assert.equal(parseSeed(text), null, text);
});

test("a parsed seed is shown as it was entered", () => {
  assert.equal(formatSeed(parseSeed("0000-002a")), "0000-002a");
});
