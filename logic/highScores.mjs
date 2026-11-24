import { LEVEL_COUNT, runSeconds } from "./run.mjs";
import { clockTime } from "./story.mjs";

export const MAX_SCORES = 10;

function validEntry(entry) {
  return entry !== null && typeof entry === "object"
    && typeof entry.score === "number" && typeof entry.seed === "number"
    && typeof entry.level === "number" && typeof entry.date === "string";
}

function validTime(entry) {
  return entry !== null && typeof entry === "object"
    && typeof entry.seconds === "number" && typeof entry.seed === "number" && typeof entry.date === "string";
}

function parseTable(text, valid) {
  let list;
  try {
    list = JSON.parse(text);
  } catch (error) {
    return [];
  }
  return Array.isArray(list) ? list.filter(valid).slice(0, MAX_SCORES) : [];
}

export function parseScores(text) {
  return parseTable(text, validEntry);
}

export function parseTimes(text) {
  return parseTable(text, validTime);
}

function insertRanked(list, entry, staysAbove) {
  let index = 0;
  while (index < list.length && staysAbove(list[index])) index++;
  if (index >= MAX_SCORES) return { list, rank: 0 };
  return { list: list.slice(0, index).concat([entry], list.slice(index)).slice(0, MAX_SCORES), rank: index + 1 };
}

export function insertScore(scores, entry) {
  if (entry.score <= 0) return { scores, rank: 0 };
  const result = insertRanked(scores, entry, other => other.score >= entry.score);
  return { scores: result.list, rank: result.rank };
}

export function insertTime(times, entry) {
  const result = insertRanked(times, entry, other => other.seconds <= entry.seconds);
  return { times: result.list, rank: result.rank };
}

export function timeEntry(run, date) {
  return { seconds: runSeconds(run), seed: run.seed, date };
}

export function runTime(seconds) {
  const hundredths = Math.round(seconds * 100);
  return clockTime(Math.floor(hundredths / 100)) + "." + String(hundredths % 100).padStart(2, "0");
}

export function scoreEntry(run, date) {
  return { score: run.score, seed: run.seed, level: run.levelNumber, won: run.won, date };
}

export function stageLabel(entry) {
  if (entry.won) return "WIN";
  return entry.level > LEVEL_COUNT ? "BOSS" : entry.level + "/" + LEVEL_COUNT;
}
