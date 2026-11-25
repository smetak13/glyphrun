import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCells, CELL_WIDTH, CELL_FONT_SIZE } from "../logic/cells.mjs";

function cell(col, text, opacity) {
  return { x: col * CELL_WIDTH, y: 48, text, role: "muted", opacity: opacity === undefined ? 1 : opacity, glow: false };
}

test("neighbouring cells of one colour and opacity become one row of text", () => {
  const rows = mergeCells([cell(2, "b"), cell(1, "a"), cell(3, "c")]);

  assert.deepEqual(rows, [{ x: CELL_WIDTH, y: 48, text: "abc", role: "muted", opacity: 1, glow: false, size: CELL_FONT_SIZE, cell: true }]);
});

test("cells with another opacity go into their own row", () => {
  const rows = mergeCells([cell(0, "a"), cell(1, "b", 0.3)]);

  assert.deepEqual(rows.map(r => [r.text, r.opacity]), [["a", 1], ["b", 0.3]]);
});

test("any gap starts a new row, so rows never hold spaces", () => {
  const rows = mergeCells([cell(0, "a"), cell(1, "b"), cell(3, "c")]);

  assert.deepEqual(rows.map(r => [r.x, r.text]), [[0, "ab"], [3 * CELL_WIDTH, "c"]]);
});
