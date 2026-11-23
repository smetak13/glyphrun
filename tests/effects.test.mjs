import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCue, clearEffects, createEffects, stepEffects, GLITCH_SLICES, PARTICLE_LIMIT } from "../logic/effects.mjs";

function settle(effects, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepEffects(effects, 1 / 60);
}

test("a bit bursts into particles where it was", () => {
  const effects = createEffects();

  applyCue(effects, { name: "bit", x: 100, y: 200 });

  assert.ok(effects.particles.length > 0);
  assert.ok(effects.particles.every(particle => particle.x === 100 && particle.y === 200 && particle.role === "bit"));
});

test("a jump raises dust without shaking the screen", () => {
  const effects = createEffects();

  applyCue(effects, { name: "jump", x: 0, y: 0 });

  assert.ok(effects.particles.every(particle => particle.text === "·"));
  assert.equal(effects.shake, 0);
});

test("a stomp shakes the screen and a hit also glitches and flashes it", () => {
  const stomp = createEffects();
  const hit = createEffects();

  applyCue(stomp, { name: "stomp", x: 0, y: 0 });
  applyCue(hit, { name: "hit", x: 0, y: 0 });

  assert.deepEqual([stomp.shake > 0, stomp.glitch, stomp.flash], [true, 0, 0]);
  assert.deepEqual([hit.shake > 0, hit.glitch > 0, hit.flash > 0], [true, true, true]);
});

test("cues without a look, such as menu sounds, change nothing", () => {
  const effects = createEffects();

  applyCue(effects, { name: "menu-move", x: 0, y: 0 });

  assert.deepEqual([effects.particles.length, effects.shake, effects.glitch, effects.flash], [0, 0, 0, 0]);
});

test("the screen shakes and glitches while the effect lasts, then settles", () => {
  const effects = createEffects();
  applyCue(effects, { name: "death", x: 0, y: 0 });

  stepEffects(effects, 1 / 60);
  const during = [effects.shakeX !== 0 || effects.shakeY !== 0, effects.slices.length];
  settle(effects, 1.1);

  assert.deepEqual(during, [true, GLITCH_SLICES]);
  assert.deepEqual([effects.shakeX, effects.shakeY, effects.slices.length, effects.flash], [0, 0, 0, 0]);
});

test("particles fall, fade and disappear", () => {
  const effects = createEffects();
  applyCue(effects, { name: "level-clear", x: 0, y: 0 });

  settle(effects, 1.2);

  assert.equal(effects.particles.length, 0);
});

test("the particle count stays within its limit", () => {
  const effects = createEffects();

  for (let i = 0; i < 10; i++) applyCue(effects, { name: "boss-defeat", x: 0, y: 0 });

  assert.equal(effects.particles.length, PARTICLE_LIMIT);
});

test("clearing the effects removes particles and stops shake, glitch and flash", () => {
  const effects = createEffects();
  applyCue(effects, { name: "death", x: 0, y: 0 });
  stepEffects(effects, 1 / 60);

  clearEffects(effects);

  assert.deepEqual([effects.particles.length, effects.shake, effects.glitch, effects.flash, effects.shakeX, effects.slices.length], [0, 0, 0, 0, 0, 0]);
});
