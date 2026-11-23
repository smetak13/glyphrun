import { createRandom } from "./random.mjs";
import { SCREEN_HEIGHT } from "./screen.mjs";

export const PARTICLE_LIMIT = 64;
export const PARTICLE_GRAVITY = 400;
export const GLITCH_SLICES = 8;
export const SHAKE_X = 35;
export const SHAKE_Y = 25;
const COSMETIC_SEED = 0x676c7966;

function burst(count, roles, chars, speed) {
  return { count, roles, chars, speed };
}

const LOOKS = {
  jump: { dust: true },
  land: { dust: true },
  bit: { burst: burst(6, ["bit"], ["0", "1"], 90) },
  "already-root": { burst: burst(10, ["hero", "bit"], ["#", "1"], 140) },
  sudo: { burst: burst(18, ["hero", "bit"], ["@", "1", "*"], 180), flash: 0.25, glitch: 0.25 },
  stomp: { burst: burst(14, ["hostile", "text"], ["x", "/", "\\", "-", "."], 120), shake: 0.35 },
  hit: { burst: burst(10, ["hero", "hostile"], ["@", "#", "%"], 160), shake: 0.4, glitch: 0.45, flash: 0.15 },
  death: { burst: burst(16, ["hero", "hostile"], ["@", "#", "%", "!"], 200), shake: 0.6, glitch: 1, flash: 0.3 },
  checkpoint: { burst: burst(10, ["cyan"], ["+", "·"], 120) },
  "level-clear": { burst: burst(30, ["cyan", "bit"], ["0", "1"], 140), flash: 0.2 },
  "boss-warning": { shake: 0.25 },
  "core-dump": { burst: burst(12, ["cyan", "text"], ["0", "1", "#"], 120), shake: 0.2 },
  "boss-hit": { burst: burst(20, ["hostile", "bit"], ["#", "%", "*"], 200), shake: 0.5, glitch: 0.5, flash: 0.2 },
  "boss-defeat": { burst: burst(40, ["hostile", "bit", "cyan"], ["0", "1", "#", "*"], 240), shake: 0.8, glitch: 1, flash: 0.4 },
};

export function createEffects() {
  return { random: createRandom(COSMETIC_SEED), particles: [], shake: 0, glitch: 0, flash: 0, shakeX: 0, shakeY: 0, slices: [] };
}

export function clearEffects(effects) {
  effects.particles = [];
  effects.shake = 0;
  effects.glitch = 0;
  effects.flash = 0;
  effects.shakeX = 0;
  effects.shakeY = 0;
  effects.slices = [];
}

function spread(random, size) {
  return (random.next() - 0.5) * size;
}

function addParticle(effects, particle) {
  effects.particles.push(particle);
  if (effects.particles.length > PARTICLE_LIMIT) effects.particles.shift();
}

function addDust(effects, x, y) {
  const random = effects.random;
  for (let i = 0; i < 5; i++) {
    const life = 0.35 + random.next() * 0.2;
    addParticle(effects, { x: x + spread(random, 16), y, vx: spread(random, 80), vy: -20 - random.next() * 40, life, maxLife: life, text: "·", role: "muted" });
  }
}

function addBurst(effects, look, x, y) {
  const random = effects.random;
  for (let i = 0; i < look.count; i++) {
    const angle = random.next() * Math.PI * 2;
    const speed = look.speed * (0.4 + random.next());
    const life = 0.6 + random.next() * 0.5;
    addParticle(effects, {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      life,
      maxLife: life,
      text: look.chars[i % look.chars.length],
      role: look.roles[i % look.roles.length],
    });
  }
}

export function applyCue(effects, cue) {
  const look = LOOKS[cue.name];
  if (!look) return;
  if (look.dust) addDust(effects, cue.x, cue.y);
  if (look.burst) addBurst(effects, look.burst, cue.x, cue.y);
  effects.shake = Math.max(effects.shake, look.shake || 0);
  effects.glitch = Math.max(effects.glitch, look.glitch || 0);
  effects.flash = Math.max(effects.flash, look.flash || 0);
}

function makeSlices(effects) {
  const random = effects.random;
  const slices = [];
  for (let i = 0; i < GLITCH_SLICES; i++) {
    slices.push({ y: random.next() * SCREEN_HEIGHT, height: 4 + random.next() * 28, dx: spread(random, 60) * effects.glitch });
  }
  return slices;
}

export function stepEffects(effects, seconds) {
  for (const particle of effects.particles) {
    particle.vy += PARTICLE_GRAVITY * seconds;
    particle.x += particle.vx * seconds;
    particle.y += particle.vy * seconds;
    particle.life -= seconds;
  }
  effects.particles = effects.particles.filter(particle => particle.life > 0);
  effects.shake = Math.max(effects.shake - seconds, 0);
  effects.glitch = Math.max(effects.glitch - seconds, 0);
  effects.flash = Math.max(effects.flash - seconds, 0);
  const shaking = effects.shake > 0;
  effects.shakeX = shaking ? spread(effects.random, SHAKE_X) * effects.shake : 0;
  effects.shakeY = shaking ? spread(effects.random, SHAKE_Y) * effects.shake : 0;
  effects.slices = effects.glitch > 0 ? makeSlices(effects) : [];
}
