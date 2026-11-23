import { test } from "node:test";
import assert from "node:assert/strict";
import { backdropLayers, backdropOffset, BACKDROP_WIDTH } from "../logic/backdrop.mjs";

test("the hexdump backdrop is the same every time", () => {
  assert.deepEqual(backdropLayers(), backdropLayers());
});

test("the hexdump backdrop fills both layers with hex text inside its width", () => {
  const layers = backdropLayers();

  for (const glyph of layers.far.concat(layers.near)) {
    assert.match(glyph.text, /^(0x[0-9a-f]{4}|([0-9a-f]{2} ){3}[0-9a-f]{2})$/);
    assert.ok(glyph.x >= 0 && glyph.x < BACKDROP_WIDTH);
  }
  assert.ok(layers.far.length > 50 && layers.near.length > 50);
});

test("the backdrop scrolls slower than the camera and wraps around", () => {
  assert.equal(backdropOffset(100, 0.3), -30);
  assert.equal(backdropOffset(BACKDROP_WIDTH / 0.5 + 100, 0.5), -50);
});
