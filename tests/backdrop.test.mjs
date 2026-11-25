import { test } from "node:test";
import assert from "node:assert/strict";
import { BACKDROP_FAMILIES, MAX_OPACITY, backdropOffset, buildBackdrop, BACKDROP_WIDTH } from "../logic/backdrop.mjs";
import { createRandom } from "../logic/random.mjs";
import { SCREEN_HEIGHT } from "../logic/screen.mjs";

const BACKDROP_ROLES = ["muted", "text", "cyan", "platform", "block", "ground"];

function variants(family) {
  const backdrops = [];
  for (let i = 0; i < 10; i++) backdrops.push(buildBackdrop(family, createRandom(i + 1)));
  return backdrops;
}

test("there are twenty background families with their own names", () => {
  const names = BACKDROP_FAMILIES.map(family => family.name);

  assert.equal(names.length, 20);
  assert.equal(new Set(names).size, 20);
});

test("backgrounds are always faint and never in a hazard colour", () => {
  for (const family of BACKDROP_FAMILIES) {
    for (const backdrop of variants(family)) {
      for (const glyph of backdrop.far.concat(backdrop.near)) {
        assert.ok(glyph.opacity > 0 && glyph.opacity <= MAX_OPACITY, family.name + " " + glyph.opacity);
        assert.ok(BACKDROP_ROLES.indexOf(glyph.role) >= 0, family.name + " " + glyph.role);
        assert.equal(glyph.glow, false);
      }
    }
  }
});

test("every background fills both layers inside its width and the screen's height", () => {
  for (const family of BACKDROP_FAMILIES) {
    for (const backdrop of variants(family)) {
      assert.ok(backdrop.far.length > 0 && backdrop.near.length > 0, family.name);
      for (const glyph of backdrop.far.concat(backdrop.near)) {
        assert.ok(glyph.y >= -glyph.size && glyph.y < SCREEN_HEIGHT, family.name);
        if (glyph.cell) assert.ok(glyph.x >= 0 && glyph.x < BACKDROP_WIDTH, family.name);
        else assert.ok(glyph.x < BACKDROP_WIDTH && glyph.x + glyph.text.length * glyph.size > 0, family.name);
      }
    }
  }
});

test("the same random stream builds the same background", () => {
  for (const family of BACKDROP_FAMILIES) assert.deepEqual(buildBackdrop(family, createRandom(5)), buildBackdrop(family, createRandom(5)));
});

test("the backdrop scrolls slower than the camera and wraps around", () => {
  assert.equal(backdropOffset(100, 0.3), -30);
  assert.equal(backdropOffset(BACKDROP_WIDTH / 0.5 + 100, 0.5), -50);
});
