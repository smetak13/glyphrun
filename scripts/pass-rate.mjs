import { generateLevel } from "../logic/generator.mjs";
import { LEVEL_COUNT } from "../logic/run.mjs";
import { MAX_ATTEMPTS, validateLevel } from "../logic/validator.mjs";

const seedCount = Number(process.argv[2] || 200);
const started = Date.now();
const reasons = {};
const perLevel = [];

for (let number = 1; number <= LEVEL_COUNT; number++) {
  const counts = { firstAttempt: 0, retried: 0, fallback: 0 };
  for (let i = 0; i < seedCount; i++) {
    const seed = Math.imul(i + 1, 0x9e3779b1) >>> 0;
    let attempt = 0;
    let failures = validateLevel(generateLevel(seed, number, 0), seed, number);
    for (const reason of failures) reasons[reason] = (reasons[reason] || 0) + 1;
    while (failures.length > 0 && ++attempt < MAX_ATTEMPTS) failures = validateLevel(generateLevel(seed, number, attempt), seed, number);
    if (attempt === 0) counts.firstAttempt++;
    else if (failures.length === 0) counts.retried++;
    else counts.fallback++;
  }
  perLevel.push(counts);
}

const percent = count => ((100 * count) / seedCount).toFixed(1) + " %";
console.log("Seeds: " + seedCount + " per level, " + MAX_ATTEMPTS + " attempts before the fallback");
perLevel.forEach((counts, i) => {
  console.log("Level " + (i + 1) + ": first attempt " + percent(counts.firstAttempt) + ", after retries " + percent(counts.retried) + ", fallback " + percent(counts.fallback));
});
const total = perLevel.reduce((sum, counts) => sum + counts.firstAttempt, 0);
console.log("First-attempt pass rate: " + ((100 * total) / (seedCount * LEVEL_COUNT)).toFixed(1) + " %");
console.log("First-attempt failures by rule:");
for (const reason of Object.keys(reasons)) console.log("  " + reason + ": " + reasons[reason]);
console.log("Took " + ((Date.now() - started) / 1000).toFixed(1) + " s");
