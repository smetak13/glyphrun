import { shuffle, subStream } from "./random.mjs";
import { TERRAIN_FAMILIES, buildTerrain } from "./terrain.mjs";
import { BACKDROP_FAMILIES, buildBackdrop } from "./backdrop.mjs";

export function styleFamilies(seed, levelNumber) {
  const terrains = shuffle(subStream(seed, "style-terrains"), TERRAIN_FAMILIES);
  const backdrops = shuffle(subStream(seed, "style-backdrops"), BACKDROP_FAMILIES);
  return { terrain: terrains[levelNumber - 1], backdrop: backdrops[levelNumber - 1] };
}

export function levelStyle(seed, levelNumber) {
  const families = styleFamilies(seed, levelNumber);
  const random = subStream(seed, "style-" + levelNumber);
  return { terrain: buildTerrain(families.terrain, random), backdrop: buildBackdrop(families.backdrop, random) };
}
