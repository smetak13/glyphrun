import { test } from "node:test";
import assert from "node:assert/strict";
import { TERRAIN_FAMILIES, BLOCK_STYLES, PLATFORM_STYLES, SURFACES, DECOR_OPACITY, blockLook, buildTerrain } from "../logic/terrain.mjs";
import { createRandom } from "../logic/random.mjs";

const TERRAIN_ROLES = ["muted", "ground", "cyan", "platform", "block"];
const VARIANTS = 30;

function variants(family) {
  const terrains = [];
  for (let i = 0; i < VARIANTS; i++) terrains.push(buildTerrain(family, createRandom(i + 1)));
  return terrains;
}

function fillSample(terrain) {
  const looks = [];
  for (let depth = 1; depth <= 6; depth++) for (let x = 0; x < 80; x++) looks.push(terrain.fill(x, 15 + depth, depth));
  return looks;
}

test("there are twenty terrain families with their own names and moods", () => {
  const names = TERRAIN_FAMILIES.map(family => family.name);

  assert.equal(names.length, 20);
  assert.equal(new Set(names).size, 20);
  for (const family of TERRAIN_FAMILIES) assert.ok(family.moods.length > 0 && family.moods.every(mood => ["nature", "machine", "data"].indexOf(mood) >= 0));
});

test("ground fill is one visible glyph per cell, at least 0.7 opaque, in the terrain colours", () => {
  for (const family of TERRAIN_FAMILIES) {
    for (const terrain of variants(family)) {
      for (const look of fillSample(terrain)) {
        assert.equal([...look.text].length, 1, family.name);
        assert.notEqual(look.text.trim(), "", family.name);
        assert.ok(look.opacity >= 0.7, family.name);
        assert.ok(TERRAIN_ROLES.indexOf(look.role) >= 0, family.name + " " + look.role);
      }
    }
  }
});

test("colour accents in the fill stay sparse", () => {
  for (const family of TERRAIN_FAMILIES) {
    for (const terrain of variants(family)) {
      const looks = fillSample(terrain);
      const accents = looks.filter(look => look.role !== "muted").length;
      assert.ok(accents / looks.length <= 0.35, family.name + " " + accents / looks.length);
    }
  }
});

test("the surface is a heavy top edge in the ground colour", () => {
  for (const family of TERRAIN_FAMILIES) {
    for (const terrain of variants(family)) assert.ok(SURFACES.indexOf(terrain.surface.text) >= 0 && terrain.surface.role === "ground" && terrain.surface.opacity === 1);
  }
});

test("decorations are faint and never in a hazard colour", () => {
  for (const family of TERRAIN_FAMILIES) {
    for (const terrain of variants(family)) {
      if (!terrain.decor) continue;
      assert.equal(terrain.decor.opacity, DECOR_OPACITY, family.name);
      assert.ok(TERRAIN_ROLES.indexOf(terrain.decor.role) >= 0, family.name);
    }
  }
});

test("every terrain picks a block style and a platform style from the shared lists", () => {
  for (const family of TERRAIN_FAMILIES) {
    for (const terrain of variants(family)) {
      assert.ok(BLOCK_STYLES.indexOf(terrain.blocks) >= 0, family.name);
      assert.ok(PLATFORM_STYLES.indexOf(terrain.platform) >= 0, family.name);
    }
  }
});

test("blocks fill both cells of a tile in the block colour, at least 0.7 opaque", () => {
  for (const style of BLOCK_STYLES) {
    for (let mask = 0; mask < 16; mask++) {
      const neighbours = { left: (mask & 1) > 0, right: (mask & 2) > 0, up: (mask & 4) > 0, down: (mask & 8) > 0 };
      for (const isLeft of [true, false]) {
        const look = blockLook(style, isLeft, neighbours);
        assert.notEqual(look.text.trim(), "", style);
        assert.ok(look.role === "block" && look.opacity >= 0.7, style);
      }
    }
  }
});

test("a lone box block is bracketed and a wider one has corners", () => {
  const lone = { left: false, right: false, up: false, down: false };
  const topLeft = { left: false, right: true, up: false, down: true };

  assert.deepEqual([blockLook("box", true, lone).text, blockLook("box", false, lone).text], ["[", "]"]);
  assert.equal(blockLook("box", true, topLeft).text, "╔");
});

test("the same random stream builds the same terrain", () => {
  for (const family of TERRAIN_FAMILIES) {
    const a = buildTerrain(family, createRandom(9));
    const b = buildTerrain(family, createRandom(9));
    assert.deepEqual(fillSample(a), fillSample(b));
    assert.deepEqual([a.surface, a.blocks, a.platform, a.decor], [b.surface, b.blocks, b.platform, b.decor]);
  }
});
