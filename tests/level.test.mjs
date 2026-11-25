import { test } from "node:test";
import assert from "node:assert/strict";
import { checkpointGlyphs, levelGlyphs, levelSections, parseLevel, SECTION_OVERHANG, SECTION_WIDTH } from "../logic/level.mjs";
import { CELL_WIDTH } from "../logic/cells.mjs";
import { DECOR_DROP } from "../logic/terrain.mjs";
import { TEST_LEVEL } from "../logic/testLevel.mjs";
import { TILE } from "../logic/screen.mjs";

const TERRAIN = {
  surface: { text: "▀", role: "ground", opacity: 1 },
  fill: (x, row, depth) => ({ text: String(depth), role: "muted", opacity: 1 }),
  blocks: "shade",
  platform: ["<", "-", ">"],
  decor: null,
  decorRate: 0,
  salt: 1,
};

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

test("the top ground tile is drawn as a glowing surface and the tiles under it as fill, two cells each", () => {
  const rows = withRow(withRow(blankRows(1), 20, "#"), 21, "#");

  const glyphs = levelGlyphs(parseLevel(rows), TERRAIN);

  assert.deepEqual(glyphs.map(g => [g.x, g.y, g.text, g.role, g.glow, g.cell]), [
    [0, 20 * TILE, "▀", "ground", true, true],
    [CELL_WIDTH, 20 * TILE, "▀", "ground", true, true],
    [0, 21 * TILE, "1", "muted", false, true],
    [CELL_WIDTH, 21 * TILE, "1", "muted", false, true],
  ]);
});

test("the terrain fills each ground cell by its depth under the surface", () => {
  let rows = blankRows(1);
  for (let row = 18; row < 22; row++) rows = withRow(rows, row, "#");

  const glyphs = levelGlyphs(parseLevel(rows), TERRAIN);

  assert.deepEqual(glyphs.filter((g, i) => i % 2 === 0).map(g => g.text), ["▀", "1", "2", "3"]);
});

test("decorations stand on the surface only where the tile above is empty", () => {
  const rows = withRow(withRow(blankRows(2), 19, ".b"), 20, "##");
  const terrain = Object.assign({}, TERRAIN, { decor: { text: '"', role: "ground", opacity: 0.3 }, decorRate: 1 });

  const decor = levelGlyphs(parseLevel(rows), terrain).filter(g => g.text === '"');

  assert.deepEqual(decor.map(g => [g.x, g.y, g.glow]), [[0, 19 * TILE + DECOR_DROP, false], [CELL_WIDTH, 19 * TILE + DECOR_DROP, false]]);
});

test("blocks are drawn in the terrain's block style and glow", () => {
  const rows = withRow(blankRows(3), 10, ".BB");
  const terrain = Object.assign({}, TERRAIN, { blocks: "box" });

  const glyphs = levelGlyphs(parseLevel(rows), terrain);

  assert.deepEqual(glyphs.map(g => [g.text, g.role, g.glow]), [["[", "block", true], ["═", "block", true], ["═", "block", true], ["]", "block", true]]);
});

test("a run of platform tiles is drawn as one platform in the terrain's platform style", () => {
  const rows = withRow(blankRows(6), 10, ".===..");

  const glyphs = levelGlyphs(parseLevel(rows), TERRAIN);

  assert.deepEqual(glyphs, [{ x: TILE, y: 10 * TILE + 2, text: "<---->", role: "platform", size: 20, opacity: 1, glow: true, cell: false }]);
});

test("a pipe is drawn as one cyan pipe with a rim on top", () => {
  const rows = withRow(withRow(blankRows(4), 19, ".HH."), 20, ".HH.");

  const glyphs = levelGlyphs(parseLevel(rows), TERRAIN);

  assert.deepEqual(glyphs.map(g => [g.text, g.x, g.y, g.role]), [["╓──╖", TILE, 19 * TILE, "cyan"], ["║  ║", TILE, 20 * TILE, "cyan"]]);
});

test("sections cover the level, merge its cells into rows and keep every glyph inside", () => {
  const level = parseLevel(TEST_LEVEL);

  const sections = levelSections(level, TERRAIN);

  const glyphs = levelGlyphs(level, TERRAIN);
  const drawnCells = sections.reduce((n, s) => n + s.glyphs.filter(g => g.cell).reduce((m, g) => m + g.text.replace(/ /g, "").length, 0), 0);
  const drawnOthers = sections.reduce((n, s) => n + s.glyphs.filter(g => !g.cell).length, 0);
  assert.equal(sections.length, Math.ceil((level.cols * TILE) / SECTION_WIDTH));
  assert.equal(drawnCells, glyphs.filter(g => g.cell).length);
  assert.equal(drawnOthers, glyphs.filter(g => !g.cell).length);
  for (const section of sections) {
    for (const glyph of section.glyphs) assert.ok(glyph.x >= 0 && glyph.x < SECTION_WIDTH + SECTION_OVERHANG);
  }
});

test("cell rows never bridge a pit, so the ground after it stays in place", () => {
  const rows = withRow(withRow(blankRows(8), 20, "###..###"), 21, "###..###");

  const sections = levelSections(parseLevel(rows), TERRAIN);

  const cellRows = sections[0].glyphs.filter(g => g.cell);
  assert.ok(cellRows.every(g => g.text.indexOf(" ") < 0));
  assert.deepEqual(cellRows.filter(g => g.y === 20 * TILE).map(g => [g.x, g.text]), [[0, "▀▀▀▀▀▀"], [5 * TILE, "▀▀▀▀▀▀"]]);
});

test("bits in the map are listed with their value and are not drawn with the level", () => {
  const rows = withRow(blankRows(5), 10, ".1.0.");

  const level = parseLevel(rows);

  assert.deepEqual(level.bits, [{ col: 1, row: 10, text: "1", sudo: false }, { col: 3, row: 10, text: "0", sudo: false }]);
  assert.deepEqual(levelGlyphs(level, TERRAIN), []);
});

test("the sudo bit is listed as a bit that holds sudo and looks like any other", () => {
  const rows = withRow(blankRows(5), 10, ".0S..");

  const level = parseLevel(rows);

  assert.deepEqual(level.bits, [{ col: 1, row: 10, text: "0", sudo: false }, { col: 2, row: 10, text: "1", sudo: true }]);
  assert.deepEqual(levelGlyphs(level, TERRAIN), []);
});

test("the checkpoint flag is muted until it is lit", () => {
  const checkpoint = { col: 2, row: 18 };

  const unlit = checkpointGlyphs(checkpoint, false);
  const lit = checkpointGlyphs(checkpoint, true);

  assert.deepEqual(unlit.map(g => g.text), ["│", "│", "│", "▷"]);
  assert.deepEqual(lit.map(g => g.text), ["│", "│", "│", "▶"]);
  assert.ok(unlit.every(g => g.role === "muted") && lit.every(g => g.role === "cyan"));
});
