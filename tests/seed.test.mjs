import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIPBOARD_COMMAND, CLIPBOARD_LIMIT, clipboardSeed, formatSeed, parseSeed, typeSeed } from "../logic/seed.mjs";

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

test("typing a seed accepts hex digits in lower case and adds the dash after four", () => {
  let text = "";
  for (const character of "7F3A91C2") text = typeSeed(text, character);

  assert.equal(text, "7f3a-91c2");
});

test("typing a seed ignores anything that is not a hex digit or the dash after four", () => {
  assert.equal(typeSeed("7f", "g"), "7f");
  assert.equal(typeSeed("7f", "-"), "7f");
  assert.equal(typeSeed("7f3a", "-"), "7f3a-");
  assert.equal(typeSeed("7f3a-", "-"), "7f3a-");
});

test("typing a seed stops after eight hex digits", () => {
  assert.equal(typeSeed("7f3a-91c2", "5"), "7f3a-91c2");
});

test("a seed is read from a clipboard within the limit", () => {
  const text = "7f3a-91c2" + " ".repeat(CLIPBOARD_LIMIT - 9);

  const seed = clipboardSeed(text, CLIPBOARD_LIMIT);

  assert.equal(seed, 0x7f3a91c2);
});

test("a clipboard over the limit is rejected even when it starts with a seed", () => {
  const text = "7f3a-91c2" + " ".repeat(CLIPBOARD_LIMIT - 8);

  const seed = clipboardSeed(text, CLIPBOARD_LIMIT + 1);

  assert.equal(seed, null);
});

test("the clipboard is read only up to one byte over the limit", () => {
  assert.ok(CLIPBOARD_COMMAND.endsWith("| head -c " + (CLIPBOARD_LIMIT + 1)));
});
