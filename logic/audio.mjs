import { subStream, shuffle, pick } from "./random.mjs";
import { LEVEL_COUNT } from "./run.mjs";

export const LEVEL_TRACKS = ["level-01", "level-02", "level-03", "level-04", "level-05", "level-06", "level-07", "level-08", "level-09", "level-10"];
export const BOSS_TRACKS = ["boss-01", "boss-02", "boss-03", "boss-04", "boss-05"];
export const SOUNDS = [
  "jump",
  "land",
  "bit",
  "sudo",
  "already-root",
  "one-up",
  "stomp",
  "hit",
  "death",
  "checkpoint",
  "level-clear",
  "boss-warning",
  "boss-hit",
  "boss-defeat",
  "core-dump",
  "game-over",
  "victory",
  "menu-move",
  "menu-select",
  "pause",
];
export const EFFECT_LOUDNESS_DB = -18;
export const JUMP_LOUDNESS_DB = -21;
export const SOUND_GAINS = {
  jump: 0.17,
  land: 0.5,
  bit: 0.38,
  sudo: 0.45,
  "already-root": 0.6,
  "one-up": 0.49,
  stomp: 0.33,
  hit: 0.17,
  death: 0.34,
  checkpoint: 0.43,
  "level-clear": 0.64,
  "boss-warning": 0.16,
  "boss-hit": 0.52,
  "boss-defeat": 0.74,
  "core-dump": 0.29,
  "game-over": 0.47,
  victory: 0.66,
  "menu-move": 0.19,
  "menu-select": 0.33,
  pause: 0.27,
};

export function runTracks(seed) {
  const random = subStream(seed, "music");
  return { levels: shuffle(random, LEVEL_TRACKS).slice(0, LEVEL_COUNT), boss: pick(random, BOSS_TRACKS) };
}

export function trackFor(seed, levelNumber) {
  const tracks = runTracks(seed);
  return levelNumber > LEVEL_COUNT ? tracks.boss : tracks.levels[levelNumber - 1];
}
