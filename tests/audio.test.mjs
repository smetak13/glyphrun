import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BOSS_TRACKS, EFFECT_LOUDNESS_DB, JUMP_LOUDNESS_DB, LEVEL_TRACKS, SOUND_GAINS, SOUNDS, runTracks, trackFor } from "../logic/audio.mjs";
import { generateLevel } from "../logic/generator.mjs";
import { LEVEL_COUNT } from "../logic/run.mjs";
import { EFFECT_NAMES, renderEffect } from "../scripts/audio/effects.mjs";
import { LEVEL_TRACKS as GENERATED_LEVEL_TRACKS, BOSS_TRACKS as GENERATED_BOSS_TRACKS } from "../scripts/audio/tracks.mjs";

const SEEDS = Array.from({ length: 200 }, (_, i) => (i * 0x9e3779b9) >>> 0);

function assetExists(path) {
  return fs.existsSync(new URL("../assets/audio/" + path, import.meta.url));
}

test("the track lists name the generated tracks and every track file exists", () => {
  assert.deepEqual(LEVEL_TRACKS, GENERATED_LEVEL_TRACKS.map(track => track.file));
  assert.deepEqual(BOSS_TRACKS, GENERATED_BOSS_TRACKS.map(track => track.file));
  for (const track of LEVEL_TRACKS.concat(BOSS_TRACKS)) assert.ok(assetExists("music/" + track + ".ogg"), track);
});

test("the sounds are the generated effects and every effect file exists", () => {
  assert.deepEqual(SOUNDS.slice().sort(), EFFECT_NAMES.slice().sort());
  for (const sound of SOUNDS) assert.ok(assetExists("sfx/" + sound + ".wav"), sound);
});

test("the same seed always plays the same tracks", () => {
  for (const seed of SEEDS) assert.deepEqual(runTracks(seed), runTracks(seed));
});

test("a run's levels play different level tracks", () => {
  for (const seed of SEEDS) {
    const levels = [];
    for (let level = 1; level <= LEVEL_COUNT; level++) levels.push(trackFor(seed, level));
    assert.equal(new Set(levels).size, LEVEL_COUNT);
    for (const track of levels) assert.ok(LEVEL_TRACKS.includes(track));
  }
});

test("the boss stage plays a boss track", () => {
  for (const seed of SEEDS) assert.ok(BOSS_TRACKS.includes(trackFor(seed, LEVEL_COUNT + 1)));
});

test("seeds vary the music, using every level track as the first and every boss track", () => {
  const first = new Set(SEEDS.map(seed => trackFor(seed, 1)));
  const boss = new Set(SEEDS.map(seed => trackFor(seed, LEVEL_COUNT + 1)));

  assert.equal(first.size, LEVEL_TRACKS.length);
  assert.equal(boss.size, BOSS_TRACKS.length);
});

test("choosing the music does not change any generated level", () => {
  const seed = 0x7f3a91c2;
  const before = [1, 2, 3, 4, 5].map(level => JSON.stringify(generateLevel(seed, level, 0)));

  runTracks(seed);
  const after = [1, 2, 3, 4, 5].map(level => JSON.stringify(generateLevel(seed, level, 0)));

  assert.deepEqual(after, before);
});

function loudnessDb(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer.left[i] ** 2 + buffer.right[i] ** 2;
  return 10 * Math.log10(sum / (2 * buffer.length));
}

test("every effect plays at the same loudness, under the music, and the jump quieter still", () => {
  for (const sound of SOUNDS) {
    const target = sound === "jump" ? JUMP_LOUDNESS_DB : EFFECT_LOUDNESS_DB;

    const played = loudnessDb(renderEffect(sound)) + 20 * Math.log10(SOUND_GAINS[sound]);

    assert.ok(Math.abs(played - target) < 0.5, sound + " plays at " + played.toFixed(1) + " dB");
  }
});
