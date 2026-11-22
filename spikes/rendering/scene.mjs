export const W = 960;
export const H = 540;
export const T = 24;
export const LEVEL_COLS = 160;
export const LEVEL_WIDTH = LEVEL_COLS * T;
export const MOVER_COUNT = 30;
export const PARTICLE_COUNT = 80;
export const GLITCH_SLICES = 8;

const GROUND_ROW = 19;
const CAMERA_SPEED = 156;
const HERO_SCREEN_X = 320;
const GLITCH_PERIOD = 2.5;
const GLITCH_LENGTH = 0.45;
const BURST_PERIOD = 0.35;

export const KANAGAWA = {
  background: "#16161D",
  backdrop: "#101017",
  surface: "#2A2A37",
  muted: "#727169",
  foreground: "#DCD7BA",
  ground: "#98BB6C",
  platform: "#7E9CD8",
  block: "#957FB8",
  hero: "#E6C384",
  bit: "#E6C384",
  cyan: "#7AA89F",
  hostile: "#E46876",
  hostileAlt: "#D27E99",
  orange: "#FFA066",
  hexFar: "#22222c",
  hexNear: "#2f2f3d",
};

export function createPrng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isPit(col) {
  const c = col % 40;
  return (c >= 28 && c <= 30) || (col >= 54 && c >= 14 && c <= 17);
}

export function buildLevel(seed) {
  const rand = createPrng(seed);
  const glyphs = [];
  const add = (x, y, ch, role, size) => glyphs.push({ x, y, ch, role, size });
  for (let col = 0; col < LEVEL_COLS; col++) {
    if (isPit(col)) continue;
    add(col * T, GROUND_ROW * T - 2, "▀", "ground", 26);
    for (let row = GROUND_ROW + 1; row < 22; row++) add(col * T, row * T - 2, rand() < 0.5 ? "░" : "▒", "muted", 26);
  }
  for (let base = 0; base < LEVEL_COLS; base += 40) {
    add((base + 28) * T, 21 * T, "/dev/null", "hostile", 12);
    for (const [col, row, n] of [[33, 16, 5], [7, 17, 3], [11, 15, 3]]) {
      if (base + col + n > LEVEL_COLS) continue;
      add((base + col) * T, row * T + 2, "[" + "=".repeat(n * 2 - 2) + "]", "platform", 20);
    }
    for (let i = 0; i < 4; i++) {
      for (let h = 0; h <= i; h++) add((base + 20 + i) * T, (18 - h) * T - 2, "▓", "block", 26);
    }
  }
  const exitX = (LEVEL_COLS - 6) * T;
  add(exitX - 18, 13 * T, "┌──────┐", "cyan", 16);
  for (let i = 1; i <= 8; i++) add(exitX - 18, 13 * T + i * 16, "│      │", "cyan", 16);
  add(exitX - 2, 13 * T + 56, "exit", "cyan", 13);
  return glyphs;
}

export function buildHexdump(seed) {
  const rand = createPrng(seed);
  const byte = () => Math.floor(rand() * 256).toString(16).padStart(2, "0");
  const far = [];
  for (let x = 0; x < LEVEL_WIDTH; x += 130) {
    for (let y = 48; y < H - 90; y += 15) {
      if (rand() < 0.5) far.push({ x, y, text: [byte(), byte(), byte(), byte()].join(" ") });
    }
  }
  const near = [];
  for (let i = 0; i < 140; i++) {
    near.push({ x: rand() * LEVEL_WIDTH, y: 60 + rand() * 330, text: "0x" + Math.floor(rand() * 65535).toString(16).padStart(4, "0") });
  }
  return { far, near };
}

const MOVER_KINDS = [
  { ch: "ж", role: "hostile", size: 26, motion: "walk" },
  { ch: "Z", role: "hostileAlt", size: 26, motion: "float", label: "<defunct>" },
  { ch: "0", role: "bit", size: 20, motion: "bob" },
  { ch: "1", role: "bit", size: 20, motion: "bob" },
  { ch: "o", role: "hostile", size: 24, motion: "hop" },
  { ch: "▼", role: "hostileAlt", size: 24, motion: "hang" },
];

export function createScene(seed) {
  const rand = createPrng(seed);
  const movers = [];
  for (let i = 0; i < MOVER_COUNT; i++) {
    const kind = MOVER_KINDS[i % MOVER_KINDS.length];
    const baseY = kind.motion === "bob" ? (10 + rand() * 7) * T : kind.motion === "float" ? (14 + rand() * 3) * T : kind.motion === "hang" ? 6 * T : GROUND_ROW * T;
    movers.push(Object.assign({}, kind, {
      slot: (i + 0.5) * (W + 2 * T) / MOVER_COUNT,
      phase: rand() * Math.PI * 2,
      baseY,
      x: 0,
      y: baseY,
      visible: true,
    }));
  }
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, ch: "·", role: "muted", opacity: 0 });
  const glitchSlices = [];
  for (let i = 0; i < GLITCH_SLICES; i++) glitchSlices.push({ y: 0, h: 0, dx: 0 });
  return {
    rand,
    time: 0,
    camX: 0,
    direction: 1,
    hero: { x: HERO_SCREEN_X, y: GROUND_ROW * T, big: true },
    movers,
    particles,
    nextParticle: 0,
    burstTimer: 0,
    glitch: 0,
    glitchSlices,
    shakeX: 0,
    shakeY: 0,
  };
}

function wrapSlot(slot, camX) {
  const span = W + 2 * T;
  return camX - T + ((((slot - camX) % span) + span) % span);
}

function moveMover(m, scene) {
  const t = scene.time;
  const homeX = wrapSlot(m.slot, scene.camX);
  if (m.motion === "walk") {
    m.x = homeX + Math.sin(t * 1.4 + m.phase) * 30;
    m.y = m.baseY - Math.abs(Math.sin(t * 8 + m.phase)) * 2;
  } else if (m.motion === "float") {
    m.x = homeX + Math.sin(t * 0.8 + m.phase) * 40;
    m.y = m.baseY + Math.sin(t * 2.5 + m.phase) * 4;
  } else if (m.motion === "bob") {
    m.x = homeX;
    m.y = m.baseY + Math.sin(t * 3 + m.phase) * 3;
  } else if (m.motion === "hop") {
    m.x = homeX;
    m.y = m.baseY - Math.max(0, Math.sin(t * 4 + m.phase)) * 2 * T;
  } else {
    m.x = homeX;
    m.y = m.baseY + (0.5 + 0.5 * Math.sin(t * 1.2 + m.phase)) * 12 * T;
  }
}

function spawnBurst(scene, x, y, count, role, chars) {
  for (let i = 0; i < count; i++) {
    const p = scene.particles[scene.nextParticle];
    scene.nextParticle = (scene.nextParticle + 1) % scene.particles.length;
    const angle = scene.rand() * Math.PI * 2;
    const speed = 120 * (0.4 + scene.rand());
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed - 60;
    p.life = 0.6 + scene.rand() * 0.5;
    p.ch = chars[i % chars.length];
    p.role = role;
  }
}

function stepCamera(scene, dt) {
  scene.camX += scene.direction * CAMERA_SPEED * dt;
  const maxX = LEVEL_WIDTH - W;
  if (scene.camX > maxX) {
    scene.camX = maxX;
    scene.direction = -1;
  } else if (scene.camX < 0) {
    scene.camX = 0;
    scene.direction = 1;
  }
}

function stepGlitch(scene) {
  const phase = scene.time % GLITCH_PERIOD;
  scene.glitch = phase < GLITCH_LENGTH ? 1 - phase / GLITCH_LENGTH : 0;
  const strength = scene.glitch;
  for (const s of scene.glitchSlices) {
    s.y = scene.rand() * H;
    s.h = 4 + scene.rand() * 28;
    s.dx = (scene.rand() - 0.5) * 60 * strength;
  }
  scene.shakeX = strength > 0 ? (scene.rand() - 0.5) * 14 * strength : 0;
  scene.shakeY = strength > 0 ? (scene.rand() - 0.5) * 10 * strength : 0;
}

export function stepScene(scene, dt) {
  scene.time += dt;
  stepCamera(scene, dt);
  const jump = (scene.time % 1.2) / 1.2;
  scene.hero.x = scene.camX + HERO_SCREEN_X;
  scene.hero.y = GROUND_ROW * T - 4 * 3 * T * jump * (1 - jump);
  for (const m of scene.movers) moveMover(m, scene);
  scene.burstTimer += dt;
  if (scene.burstTimer >= BURST_PERIOD) {
    scene.burstTimer -= BURST_PERIOD;
    const target = scene.movers[Math.floor(scene.rand() * scene.movers.length)];
    spawnBurst(scene, target.x, target.y - 12, 14, target.role, [target.ch, "/", "\\", "-", "."]);
  }
  for (const p of scene.particles) {
    if (!p.alive) continue;
    p.vy += 400 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.alive = p.life > 0;
    p.opacity = Math.min(1, p.life * 2);
  }
  stepGlitch(scene);
}

export function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  return { count: samples.length, mean, p50: pick(0.5), p95: pick(0.95), p99: pick(0.99), max: sorted[sorted.length - 1] };
}
