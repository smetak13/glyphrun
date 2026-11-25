import { shuffle, subStream } from "./random.mjs";
import { TERRAIN_FAMILIES, buildTerrain } from "./terrain.mjs";
import { BACKDROP_FAMILIES, buildBackdrop } from "./backdrop.mjs";

export function sharesMood(a, b) {
  return a.moods.some(mood => b.moods.indexOf(mood) >= 0);
}

export function styleFamilies(seed, levelNumber) {
  const terrains = shuffle(subStream(seed, "style-terrains"), TERRAIN_FAMILIES);
  const backdrops = shuffle(subStream(seed, "style-backdrops"), BACKDROP_FAMILIES);
  const used = [];
  for (let n = 0; n < levelNumber; n++) {
    used.push(backdrops.filter(backdrop => used.indexOf(backdrop) < 0 && sharesMood(backdrop, terrains[n]))[0]);
  }
  return { terrain: terrains[levelNumber - 1], backdrop: used[levelNumber - 1] };
}

export function levelStyle(seed, levelNumber) {
  const families = styleFamilies(seed, levelNumber);
  const random = subStream(seed, "style-" + levelNumber);
  return { terrain: buildTerrain(families.terrain, random), backdrop: buildBackdrop(families.backdrop, random) };
}
