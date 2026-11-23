import { test } from "node:test";
import assert from "node:assert/strict";
import { CHUNKS } from "../logic/chunks.mjs";
import { BASIC_KINDS, HANG_ROW } from "../logic/generator.mjs";
import { SCREEN_ROWS } from "../logic/screen.mjs";

const TILES = ".#B=PGE*+@CX";
const GROUND_ROWS = 3;

test("every chunk is a rectangle of known tiles", () => {
  for (const chunk of CHUNKS) {
    const width = chunk.map[0].length;
    for (const line of chunk.map) {
      assert.equal(line.length, width, chunk.name);
      for (const tile of line) assert.ok(TILES.includes(tile), chunk.name + " has " + tile);
    }
  }
});

test("every chunk fits under the hang's thread and stands on ground or a gap", () => {
  for (const chunk of CHUNKS) {
    assert.ok(chunk.map.length < SCREEN_ROWS - HANG_ROW - 1, chunk.name);
    for (const line of chunk.map.slice(-GROUND_ROWS)) assert.match(line, /^[#G]+$/, chunk.name);
  }
});

test("gap columns are empty above the ground and do not touch the chunk's edges", () => {
  for (const chunk of CHUNKS) {
    const bottom = chunk.map[chunk.map.length - 1];
    for (let col = 0; col < bottom.length; col++) {
      if (bottom[col] !== "G") continue;
      assert.ok(col > 0 && col < bottom.length - 1, chunk.name);
      for (const line of chunk.map.slice(0, -GROUND_ROWS)) assert.equal(line[col], ".", chunk.name + " column " + col);
    }
  }
});

test("chunks with gaps say how wide they may be, and only they do", () => {
  for (const chunk of CHUNKS) {
    const hasGap = chunk.map.some(line => line.includes("G"));
    assert.equal(chunk.gap !== undefined, hasGap, chunk.name);
    if (hasGap) assert.ok(chunk.gap[0] >= 1 && chunk.gap[0] <= chunk.gap[1], chunk.name);
  }
});

test("chunks with lifted platforms say how far they may lift, and only they do", () => {
  for (const chunk of CHUNKS) {
    assert.equal(chunk.lift !== undefined, chunk.map.some(line => line.includes("P")), chunk.name);
  }
});

test("there is one start, checkpoint, exit and intro chunk, and rest chunks", () => {
  const count = role => CHUNKS.filter(chunk => chunk.role === role).length;

  assert.deepEqual([count("start"), count("checkpoint"), count("exit"), count("intro")], [1, 1, 1, 1]);
  assert.ok(count("rest") > 0);
});

test("the hero, checkpoint and exit appear only in their own chunks", () => {
  for (const chunk of CHUNKS) {
    const text = chunk.map.join("");
    assert.equal(text.includes("@"), chunk.role === "start", chunk.name);
    assert.equal(text.includes("C"), chunk.role === "checkpoint", chunk.name);
    assert.equal(text.includes("X"), chunk.role === "exit", chunk.name);
  }
});

test("the intro chunk has one enemy slot, flat ground and no gap", () => {
  const intro = CHUNKS.filter(chunk => chunk.role === "intro")[0];
  const slots = intro.map.join("|").match(/E+/g);

  assert.equal(slots.length, 1);
  assert.ok(!intro.map.join("").includes("G"));
  assert.ok(!intro.map.join("").includes("B"));
});

test("rest, start, checkpoint and exit chunks hold no enemies or gaps", () => {
  for (const chunk of CHUNKS) {
    if (chunk.role === "body" || chunk.role === "intro") continue;
    assert.doesNotMatch(chunk.map.join(""), /[EG]/, chunk.name);
  }
});

test("chunk enemy kinds are basic kinds", () => {
  for (const chunk of CHUNKS) {
    for (const kind of chunk.kinds || []) assert.ok(BASIC_KINDS.includes(kind), chunk.name);
  }
});
