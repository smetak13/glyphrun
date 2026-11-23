import { test } from "node:test";
import assert from "node:assert/strict";
import { checkpointGlyphs, levelGlyphs, levelSections, parseLevel, SECTION_OVERHANG, SECTION_WIDTH } from "../logic/level.mjs";
import { TEST_LEVEL } from "../logic/testLevel.mjs";
import { TILE } from "../logic/screen.mjs";

function blankRows(cols) {
  return Array.from({ length: 22 }, () => ".".repeat(cols));
}

function withRow(rows, row, text) {
  const copy = rows.slice();
  copy[row] = text;
  return copy;
}

test("the test level has a start, a checkpoint and an exit", () => {
  const level = parseLevel(TEST_LEVEL);

  assert.deepEqual([level.start, level.checkpoint, level.exit], [{ col: 2, row: 18 }, { col: 42, row: 18 }, { col: 74, row: 18 }]);
});

test("a level with the wrong number of rows is rejected", () => {
  assert.throws(() => parseLevel(TEST_LEVEL.slice(1)), /22 rows/);
});

test("a level with rows of different widths is rejected", () => {
  assert.throws(() => parseLevel(withRow(blankRows(10), 5, "...")), /row 5/);
});

test("the top ground tile is drawn as a surface and the tiles under it as fill", () => {
  const rows = withRow(withRow(blankRows(1), 20, "#"), 21, "#");

  const glyphs = levelGlyphs(parseLevel(rows));

  assert.deepEqual(glyphs.map(g => [g.role, g.y]), [["ground", 20 * TILE - 2], ["muted", 21 * TILE - 2]]);
});

test("a run of platform tiles is drawn as one bracketed platform", () => {
  const rows = withRow(blankRows(6), 10, ".===..");

  const glyphs = levelGlyphs(parseLevel(rows));

  assert.deepEqual(glyphs, [{ x: TILE, y: 10 * TILE + 2, text: "[====]", role: "platform", size: 20 }]);
});

test("a pipe is drawn as one cyan pipe with a rim on top", () => {
  const rows = withRow(withRow(blankRows(4), 19, ".HH."), 20, ".HH.");

  const glyphs = levelGlyphs(parseLevel(rows));

  assert.deepEqual(glyphs.map(g => [g.text, g.x, g.y, g.role]), [["╓──╖", TILE, 19 * TILE, "cyan"], ["║  ║", TILE, 20 * TILE, "cyan"]]);
});

test("each pit is labelled /dev/null at its first column", () => {
  const rows = withRow(blankRows(8), 21, "##..#..#");

  const labels = levelGlyphs(parseLevel(rows)).filter(g => g.text === "/dev/null");

  assert.deepEqual(labels.map(g => g.x), [2 * TILE, 5 * TILE]);
});

test("sections cover the level and every glyph starts inside its section", () => {
  const level = parseLevel(TEST_LEVEL);

  const sections = levelSections(level);

  assert.equal(sections.length, Math.ceil((level.cols * TILE) / SECTION_WIDTH));
  assert.equal(sections.reduce((n, s) => n + s.glyphs.length, 0), levelGlyphs(level).length);
  for (const section of sections) {
    for (const glyph of section.glyphs) assert.ok(glyph.x >= 0 && glyph.x < SECTION_WIDTH + SECTION_OVERHANG);
  }
});

test("bits in the map are listed with their value and are not drawn with the level", () => {
  const rows = withRow(blankRows(5), 10, ".1.0.");

  const level = parseLevel(rows);

  assert.deepEqual(level.bits, [{ col: 1, row: 10, text: "1", sudo: false }, { col: 3, row: 10, text: "0", sudo: false }]);
  assert.deepEqual(levelGlyphs(level), []);
});

test("the sudo bit is listed as a bit that holds sudo and looks like any other", () => {
  const rows = withRow(blankRows(5), 10, ".0S..");

  const level = parseLevel(rows);

  assert.deepEqual(level.bits, [{ col: 1, row: 10, text: "0", sudo: false }, { col: 2, row: 10, text: "1", sudo: true }]);
  assert.deepEqual(levelGlyphs(level), []);
});

test("the checkpoint flag is muted until it is lit", () => {
  const checkpoint = { col: 2, row: 18 };

  const unlit = checkpointGlyphs(checkpoint, false);
  const lit = checkpointGlyphs(checkpoint, true);

  assert.deepEqual(unlit.map(g => g.text), ["│", "│", "│", "▷"]);
  assert.deepEqual(lit.map(g => g.text), ["│", "│", "│", "▶"]);
  assert.ok(unlit.every(g => g.role === "muted") && lit.every(g => g.role === "cyan"));
});
