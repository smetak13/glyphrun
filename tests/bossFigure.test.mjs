import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FACE_ROWS,
  FACE_WIDTH,
  GLITCH_EVERY_SECONDS,
  coreBits,
  dropShadow,
  faceGlitch,
  faceLayers,
  faceRows,
  faceState,
  traceLabel,
} from "../logic/bossFigure.mjs";

const STATES = ["angry", "dumping", "dead"];
const QUIET = 0.5;

function grid(text) {
  return text.split("\n").map(row => row.split(""));
}

test("the face is a framed panel of seven rows of 32 columns in every state", () => {
  for (const state of STATES) {
    for (const time of [0.5, 1.7, 3.6, 9.25]) {
      const rows = faceRows(state, time);

      assert.equal(rows.length, FACE_ROWS);
      assert.ok(rows.every(row => row.length === FACE_WIDTH), `${state} at ${time}`);
      assert.ok(rows[0].startsWith("╔") && rows[FACE_ROWS - 1].startsWith("╚"));
    }
  }
});

test("the boss's states choose the face", () => {
  assert.equal(faceState("attack"), "angry");
  assert.equal(faceState("intro"), "angry");
  assert.equal(faceState("core"), "dumping");
  for (const state of ["crash", "reboot", "done"]) assert.equal(faceState(state), "dead");
});

test("the face layers line up and never draw over each other", () => {
  for (const state of STATES) {
    const layers = faceLayers(state, QUIET);
    const hostile = grid(layers.hostile), shade = grid(layers.shade), eyes = grid(layers.eyes);

    hostile.forEach((row, r) => {
      assert.equal(row.length, FACE_WIDTH);
      row.forEach((ch, c) => {
        const drawn = [ch, shade[r][c], eyes[r][c]].filter(x => x !== " ");
        assert.ok(drawn.length <= 1, `${state} row ${r} col ${c}`);
      });
    });
  }
});

test("without a glitch the layers together draw the whole face", () => {
  for (const state of ["dumping", "dead"]) {
    const layers = faceLayers(state, QUIET);
    const hostile = grid(layers.hostile), shade = grid(layers.shade), eyes = grid(layers.eyes);

    const merged = hostile.map((row, r) => row.map((ch, c) => [ch, shade[r][c], eyes[r][c]].find(x => x !== " ") || " ").join(""));

    assert.deepEqual(merged, faceRows(state, QUIET), state);
  }
});

test("the angry face's pupils sit in its eye sockets", () => {
  const layers = faceLayers("angry", QUIET);
  const hostile = grid(layers.hostile), eyes = grid(layers.eyes);

  const pupils = [];
  eyes.forEach((row, r) => row.forEach((ch, c) => { if (ch === "█") pupils.push([r, c]); }));

  assert.equal(pupils.length, 2);
  for (const [r, c] of pupils) {
    assert.equal(hostile[r][c], " ");
    assert.ok(hostile[r][c - 1] === "█" || hostile[r][c + 1] === "█");
  }
});

test("a glitch lifts one row out of the face and shifts it", () => {
  const time = GLITCH_EVERY_SECONDS * 3 + 0.01;
  const glitch = faceGlitch(time);

  const layers = faceLayers("angry", time);

  assert.ok(glitch !== null);
  assert.equal(layers.glitchRow, glitch.row);
  assert.notEqual(layers.glitchShift, 0);
  assert.equal(layers.glitch.length, FACE_WIDTH);
  assert.equal(grid(layers.hostile)[glitch.row].join("").trim(), "");
  assert.equal(faceGlitch(QUIET), null);
});

test("dumping core spills hex bytes through the bottom of the frame", () => {
  const bottom = faceRows("dumping", 1)[FACE_ROWS - 1];

  assert.match(bottom, /▌0x[0-9a-f]{6}▐/);
});

test("a drop's shadow grows as its warning runs out", () => {
  const early = dropShadow(1, 1);
  const late = dropShadow(0.1, 1);
  const falling = dropShadow(0, 1);

  assert.ok(early.width < late.width && early.opacity < late.opacity);
  assert.equal(late.text, "▂");
  assert.equal(falling.width, 20);
});

test("a moving stack trace scrambles only its last character", () => {
  assert.equal(traceLabel("panic+0x5c", false, 1), "panic+0x5c");

  const moving = traceLabel("panic+0x5c", true, 1);

  assert.equal(moving.slice(0, -1), "panic+0x5");
  assert.ok("▒░#%".includes(moving.slice(-1)));
});

test("the core leaks rising bits that fade as they rise", () => {
  const bits = coreBits(1.2);

  assert.equal(bits.length, 3);
  for (const bit of bits) {
    assert.ok(bit.text === "0" || bit.text === "1");
    assert.ok(bit.opacity <= 0.6 && bit.y < 0);
  }
});
