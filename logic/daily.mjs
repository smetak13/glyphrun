import { runTime } from "./highScores.mjs";
import { subStream } from "./random.mjs";

export const DAILY_EPOCH = "2026-11-25";
export const DAILY_DAYS = 7;
export const SHARE_URL = "github.com/smetak13/glyphrun";
export const STREAK_GLYPH = "";
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function dayStart(day) {
  return Date.parse(day + "T00:00:00Z");
}

export function addDays(day, count) {
  return utcDay(dayStart(day) + count * DAY_MS);
}

export function dayNumber(day) {
  return Math.round((dayStart(day) - dayStart(DAILY_EPOCH)) / DAY_MS) + 1;
}

export function dailySeed(day) {
  return Math.floor(subStream(0, "daily " + day).next() * 0x100000000);
}

export function timeLeft(ms) {
  const minutes = Math.floor((dayStart(utcDay(ms)) + DAY_MS - ms) / MINUTE_MS);
  if (minutes < 1) return "<1m left";
  const hours = Math.floor(minutes / 60);
  return (hours > 0 ? hours + "h " : "") + (minutes % 60) + "m left";
}

export function shownDays(today) {
  const count = Math.max(1, Math.min(DAILY_DAYS, dayNumber(today)));
  const days = [];
  for (let i = 0; i < count; i++) days.push(addDays(today, -i));
  return days;
}

export function emptyDaily() {
  return { days: {}, streak: { count: 0, last: "" } };
}

function validDaily(daily) {
  return daily !== null && typeof daily === "object"
    && daily.days !== null && typeof daily.days === "object"
    && daily.streak !== null && typeof daily.streak === "object"
    && typeof daily.streak.count === "number" && typeof daily.streak.last === "string";
}

export function parseDaily(text) {
  let daily;
  try {
    daily = JSON.parse(text);
  } catch (error) {
    return emptyDaily();
  }
  return validDaily(daily) ? daily : emptyDaily();
}

export function dayRecord(daily, day) {
  return daily.days[day] || { tries: 0, best: null };
}

function withRecord(daily, day, record) {
  const oldest = addDays(day, 1 - DAILY_DAYS);
  const days = {};
  for (const kept of Object.keys(daily.days)) {
    if (kept >= oldest) days[kept] = daily.days[kept];
  }
  days[day] = record;
  return { days, streak: daily.streak };
}

export function startAttempt(daily, day) {
  const record = dayRecord(daily, day);
  return withRecord(daily, day, { tries: record.tries + 1, best: record.best });
}

function extendStreak(streak, day) {
  if (streak.last >= day) return streak;
  return { count: streak.last === addDays(day, -1) ? streak.count + 1 : 1, last: day };
}

export function endAttempt(daily, day, result) {
  const record = dayRecord(daily, day);
  const best = record.best === null || result.score > record.best.score ? result : record.best;
  const next = withRecord(daily, day, { tries: record.tries, best });
  return { days: next.days, streak: extendStreak(daily.streak, day) };
}

export function currentStreak(daily, today) {
  const last = daily.streak.last;
  return last === today || last === addDays(today, -1) ? daily.streak.count : 0;
}

export function groupDigits(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function resultTime(best) {
  return runTime(best.seconds) + (best.won ? "" : " (incomplete)");
}

export function triesLabel(tries) {
  return tries + (tries === 1 ? " try" : " tries");
}

export function shareLine(day, record) {
  return ["glyphrun daily #" + dayNumber(day), day, groupDigits(record.best.score), resultTime(record.best),
    triesLabel(record.tries), SHARE_URL].join(" · ");
}
