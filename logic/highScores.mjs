import { LEVEL_COUNT } from "./run.mjs";

export const MAX_SCORES = 10;

function validEntry(entry) {
  return entry !== null && typeof entry === "object"
    && typeof entry.score === "number" && typeof entry.seed === "number"
    && typeof entry.level === "number" && typeof entry.date === "string";
}

export function parseScores(text) {
  let list;
  try {
    list = JSON.parse(text);
  } catch (error) {
    return [];
  }
  return Array.isArray(list) ? list.filter(validEntry).slice(0, MAX_SCORES) : [];
}

export function insertScore(scores, entry) {
  if (entry.score <= 0) return { scores, rank: 0 };
  let index = 0;
  while (index < scores.length && scores[index].score >= entry.score) index++;
  if (index >= MAX_SCORES) return { scores, rank: 0 };
  return { scores: scores.slice(0, index).concat([entry], scores.slice(index)).slice(0, MAX_SCORES), rank: index + 1 };
}

export function scoreEntry(run, date) {
  return { score: run.score, seed: run.seed, level: run.levelNumber, won: run.won, date };
}

export function stageLabel(entry) {
  if (entry.won) return "WIN";
  return entry.level > LEVEL_COUNT ? "BOSS" : entry.level + "/" + LEVEL_COUNT;
}
