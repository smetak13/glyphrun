import { pick, randomInt } from "./random.mjs";
import { SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_ROWS } from "./screen.mjs";
import { CELL_WIDTH, CELL_HEIGHT, mergeCells } from "./cells.mjs";

export const BACKDROP_WIDTH = 2 * SCREEN_WIDTH;
export const FAR_PARALLAX = 0.3;
export const NEAR_PARALLAX = 0.6;
export const FAR_OPACITY = 0.12;
export const NEAR_OPACITY = 0.18;
export const MAX_OPACITY = 0.15;
const COLS = BACKDROP_WIDTH / CELL_WIDTH;
const ROWS = SCREEN_ROWS;
const CHAR_WIDTH = 0.6;
const LINE_HEIGHT = 1.32;
const OPACITY_STEP = 0.01;
const ACCENTS = ["cyan", "platform", "block", "ground"];
const LOGS = [
  "[  OK  ] Started network.target",
  "[  OK  ] Mounted /var/lib/docker",
  "npm WARN deprecated left-pad@1.0.0",
  "make[2]: Entering directory '/src'",
  "kernel: eth0: link up 1000Mbps",
  "[ INFO ] 14000 warnings suppressed",
  "systemd[1]: Reached target multi-user",
  "GET /api/health 200 3ms",
  "cc -O2 -Wall -c main.c -o main.o",
];
const BIG_FONT = {
  "0": ["###", "#.#", "#.#", "#.#", "###"], "4": ["#.#", "#.#", "###", "..#", "..#"],
  A: [".#.", "#.#", "###", "#.#", "#.#"], C: ["###", "#..", "#..", "#..", "###"],
  D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."], G: ["###", "#..", "#.#", "#.#", "###"],
  I: ["###", ".#.", ".#.", ".#.", "###"], K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"], M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"], O: ["###", "#.#", "#.#", "#.#", "###"],
  P: ["###", "#.#", "###", "#..", "#.."], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: ["###", "#..", "###", "..#", "###"], T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"], W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
};
const BIG_WORDS = ["404", "TODO", "NULL", "SUDO", "LGTM", "PANIC", "FIXME", "ROOT", "OOM", "EOF"];

function square(value) {
  return value * value;
}

function hex(value, digits) {
  return value.toString(16).padStart(digits, "0");
}

function makeWave(random, parts, amplitude) {
  const waves = [];
  for (let i = 0; i < parts; i++) waves.push({ cycles: randomInt(random, 1, 6), amplitude: (amplitude * (0.3 + random.next())) / parts, phase: random.next() * 2 * Math.PI });
  return col => waves.reduce((sum, w) => sum + w.amplitude * Math.sin((2 * Math.PI * w.cycles * col) / COLS + w.phase), 0);
}

function line(put, x0, y0, x1, y1, text, role, opacity, step) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0) * 2);
  for (let i = 0; i <= steps; i += step) put(text, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), role, opacity);
}

function city(random, put, minHeight, maxHeight, opacity, role, lit) {
  for (let x = 0; x < COLS; ) {
    const width = randomInt(random, 3, 9);
    const height = randomInt(random, minHeight, maxHeight);
    for (let col = x; col < x + width; col++) {
      for (let row = ROWS - height; row < ROWS; row++) {
        const window = col > x && col < x + width - 1 && row % 2 === 0 && random.next() < lit;
        if (window) put("▪", col, row, role, 1);
        else put("█", col, row, "muted", opacity);
      }
    }
    if (random.next() < 0.3) put("╻", x + Math.floor(width / 2), ROWS - height - 1, "muted", opacity * 2);
    x += width + randomInt(random, 0, 2);
  }
}

function ridge(random, put, base, amplitude, fill, opacity) {
  const wave = makeWave(random, 3, amplitude);
  for (let col = 0; col < COLS; col++) {
    const top = Math.round(base + wave(col));
    const before = Math.round(base + wave(col - 1));
    const after = Math.round(base + wave(col + 1));
    put(after > before ? "╲" : after < before ? "╱" : "─", col, top, "muted", 1);
    for (let row = top + 1; row < ROWS; row++) put(fill, col, row, "muted", opacity);
  }
}

function streams(random, put, every, chance, opacity, role) {
  const chars = "abcdef<>{}[]=+*#$%&;:/|";
  for (let col = 0; col < COLS; col += every) {
    if (random.next() > chance) continue;
    const length = randomInt(random, 4, 12);
    const head = randomInt(random, 2, ROWS);
    for (let k = 0; k < length; k++) put(chars[randomInt(random, 0, chars.length - 1)], col, head - k, k === 0 ? role : "muted", k === 0 ? 1 : opacity * (1 - k / length));
  }
}

function graph(random, put, count, node, role, opacity, reach) {
  const nodes = [];
  for (let i = 0; i < count; i++) nodes.push({ x: randomInt(random, 0, COLS - 1), y: randomInt(random, 1, ROWS - 3) });
  for (const p of nodes) {
    for (const q of nodes) if (p.x < q.x && Math.hypot(p.x - q.x, (p.y - q.y) * 2) < reach) line(put, p.x, p.y, q.x, q.y, "·", role, opacity * 0.6, 2);
  }
  for (const p of nodes) put(node, p.x, p.y, role, opacity);
}

function waves(random, put, count, text, role, opacity) {
  for (let i = 0; i < count; i++) {
    const base = randomInt(random, 3, ROWS - 6);
    const wave = makeWave(random, 2, randomInt(random, 2, 4));
    for (let col = 0; col < COLS; col++) put(text, col, Math.round(base + wave(col)), role, opacity);
  }
}

function band(random, put, base, thickness, role, opacity) {
  const wave = makeWave(random, 3, 3);
  const shimmer = makeWave(random, 2, 1);
  for (let col = 0; col < COLS; col++) {
    const center = base + wave(col);
    const t = thickness * (0.6 + 0.4 * Math.abs(shimmer(col)));
    for (let dy = -Math.ceil(t); dy <= Math.ceil(t); dy++) {
      const strength = 1 - Math.abs(dy) / (t + 1);
      if (strength > 0) put(strength > 0.6 ? "▒" : "░", col, Math.round(center + dy), role, opacity * strength);
    }
  }
}

function trees(random, put, count, minHeight, maxHeight, role, opacity) {
  for (let i = 0; i < count; i++) {
    const x = randomInt(random, 0, COLS - 1);
    const height = randomInt(random, minHeight, maxHeight);
    const base = ROWS - randomInt(random, 0, 2);
    for (let k = 0; k < height; k++) {
      const row = base - height - 2 + k;
      const half = Math.ceil(k * 0.9);
      put("╱", x - half, row, role, opacity);
      put("╲", x + half + 1, row, role, opacity);
      for (let col = x - half + 1; col <= x + half; col++) put("▒", col, row, role, opacity * 0.4);
    }
    put("│", x, base - 2, role, opacity);
    put("│", x + 1, base - 2, role, opacity);
  }
}

function clouds(random, put, count, body, opacity, rain, rainRole) {
  for (let i = 0; i < count; i++) {
    const cx = randomInt(random, 0, COLS - 1);
    const cy = randomInt(random, 2, 9);
    const rx = randomInt(random, 6, 16);
    const ry = randomInt(random, 1, 2);
    for (let col = cx - rx; col <= cx + rx; col++) {
      for (let row = cy - ry; row <= cy + ry; row++) {
        const d = square((col - cx) / rx) + square((row - cy) / ry);
        if (d <= 1) put(d > 0.6 ? "░" : body, col, row, "muted", opacity);
      }
    }
    if (rain) for (let k = 0; k < rx * 3; k++) put("╵", cx + randomInt(random, -rx, rx), cy + ry + randomInt(random, 1, 8), rainRole, 0.6);
  }
}

function hills(random, put, base, amplitude, role, opacity) {
  const eighths = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const wave = makeWave(random, 3, amplitude);
  for (let col = 0; col < COLS; col++) {
    const top = base + wave(col);
    const row = Math.floor(top);
    put(eighths[Math.min(7, Math.floor((1 - (top - row)) * 8))], col, row, role, opacity);
    for (let r = row + 1; r < ROWS; r++) put("█", col, r, role, opacity);
  }
}

function bigWord(put, word, col, row, scale, text, role, opacity) {
  let x = col;
  for (const letter of word) {
    const shape = BIG_FONT[letter];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (shape[r][c] !== "#") continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale * 2; sx++) put(text, x + c * scale * 2 + sx, row + r * scale + sy, role, opacity);
      }
    }
    x += 4 * scale * 2;
  }
}

function pylons(random, put, spacing, height, opacity) {
  const tops = [];
  for (let x = randomInt(random, 0, spacing); x < COLS; x += spacing) {
    const top = ROWS - height;
    for (let k = 0; k < height; k++) {
      const half = Math.floor(k / 2);
      put("╱", x - half, top + k, "muted", opacity);
      put("╲", x + 1 + half, top + k, "muted", opacity);
      if (k % 3 === 2) for (let c = x - half + 1; c <= x + half; c++) put("─", c, top + k, "muted", opacity * 0.6);
    }
    put("┬", x, top - 1, "muted", opacity);
    put("┬", x + 1, top - 1, "muted", opacity);
    tops.push({ x, y: top - 1 });
  }
  tops.push({ x: tops[0].x + COLS, y: tops[0].y });
  for (let i = 0; i + 1 < tops.length; i++) {
    const a = tops[i];
    const b = tops[i + 1];
    for (let col = a.x + 2; col < b.x; col++) {
      const t = (col - a.x) / (b.x - a.x);
      put("·", col, Math.round(a.y + 3 * (1 - square(2 * t - 1))), "muted", opacity);
    }
  }
}

export const BACKDROP_FAMILIES = [
  { name: "hexdump", moods: ["data"], make(random) {
    return {
      far(put, text) {
        for (let x = 0; x < BACKDROP_WIDTH; x += 130) {
          for (let y = 48; y < 450; y += 15) if (random.next() < 0.5) text([0, 0, 0, 0].map(() => hex(randomInt(random, 0, 255), 2)).join(" "), x, y, 11, "muted", 0.4);
        }
      },
      near(put, text) {
        for (let i = 0; i < 72; i++) text("0x" + hex(randomInt(random, 0, 0xffff), 4), Math.floor(random.next() * (BACKDROP_WIDTH - 60)), Math.floor(60 + random.next() * 330), 12, "muted", 0.5);
      },
    };
  } },
  { name: "skyline", moods: ["machine"], make(random) {
    const role = pick(random, ["cyan", "platform", "block"]);
    const lit = 0.1 + 0.25 * random.next();
    return {
      far(put) { city(random, put, 9, 18, 0.35, role, lit); },
      near(put) { city(random, put, 4, 10, 0.45, role, lit); },
    };
  } },
  { name: "mountains", moods: ["nature"], make(random) {
    const moon = random.next() < 0.6;
    const role = pick(random, ["cyan", "platform", "text"]);
    return {
      far(put, text) {
        if (moon) text("●", randomInt(random, 200, BACKDROP_WIDTH - 200), randomInt(random, 70, 140), 64, role, 0.8);
        ridge(random, put, 9, 6, "░", 0.5);
      },
      near(put) { ridge(random, put, 14, 4, "▒", 0.45); },
    };
  } },
  { name: "stars", moods: ["nature", "data", "machine"], make(random) {
    const role = pick(random, ["cyan", "platform", "block"]);
    const planet = random.next() < 0.5;
    return {
      far(put, text) {
        for (let i = 0; i < 280; i++) put(random.next() < 0.8 ? "·" : "∙", randomInt(random, 0, COLS - 1), randomInt(random, 0, ROWS - 4), "text", 0.3 + random.next() * 0.7);
        if (planet) {
          const x = randomInt(random, 150, BACKDROP_WIDTH - 150);
          const y = randomInt(random, 80, 170);
          text("●", x, y, 90, "muted", 1);
          text("───────────", x, y + 4, 22, role, 0.8);
        }
      },
      near(put) {
        for (let g = 0; g < 6; g++) {
          let x = randomInt(random, 0, COLS - 1);
          let y = randomInt(random, 1, 11);
          for (let k = 0; k < 4; k++) {
            const nx = x + randomInt(random, 3, 10);
            const ny = Math.max(0, Math.min(13, y + randomInt(random, -3, 3)));
            line(put, x, y, nx, ny, "·", role, 0.5, 2);
            put(pick(random, ["+", "⋆", "*"]), x, y, role, 1);
            x = nx;
            y = ny;
          }
          put("⋆", x, y, role, 1);
        }
      },
    };
  } },
  { name: "rain", moods: ["data"], make(random) {
    const role = pick(random, ["cyan", "ground", "platform"]);
    return {
      far(put) { streams(random, put, 2, 0.5, 0.8, role); },
      near(put) { streams(random, put, 3, 0.25, 0.9, role); },
    };
  } },
  { name: "synthwave", moods: ["machine", "data", "nature"], make(random) {
    const sunRole = pick(random, ["block", "cyan", "platform"]);
    const gridRole = pick(random, ["block", "cyan", "platform"]);
    const horizon = randomInt(random, 9, 12);
    const center = randomInt(random, 30, COLS - 30);
    const radius = randomInt(random, 6, 8);
    return {
      far(put) {
        for (let row = horizon - radius; row < horizon; row++) {
          const dy = horizon - row;
          if (dy < radius * 0.55 && row % 2 === 0) continue;
          const half = Math.round(Math.sqrt(radius * radius - dy * dy) * 2);
          for (let col = center - half; col <= center + half; col++) put("█", col, row, sunRole, 0.8);
        }
        for (let col = 0; col < COLS; col++) put("─", col, horizon, gridRole, 1);
      },
      near(put) {
        for (let k = 1; horizon + k * k * 0.35 < ROWS; k++) for (let col = 0; col < COLS; col++) put("─", col, Math.round(horizon + k * k * 0.35), gridRole, 0.6);
        for (let i = -20; i <= 20; i++) {
          for (let row = horizon + 1; row < ROWS; row++) put(i < 0 ? "╱" : i > 0 ? "╲" : "│", Math.round(COLS / 2 + (i * 4 * (row - horizon)) / 6), row, gridRole, 0.6);
        }
      },
    };
  } },
  { name: "network", moods: ["data"], make(random) {
    const role = pick(random, ACCENTS);
    return {
      far(put) { graph(random, put, 40, "○", "muted", 1, 24); },
      near(put) { graph(random, put, 12, "◉", role, 1, 34); },
    };
  } },
  { name: "waves", moods: ["data", "machine"], make(random) {
    const role = pick(random, ACCENTS);
    const grid = randomInt(random, 12, 24);
    return {
      far(put) {
        for (let col = 0; col < COLS; col += grid) for (let row = 0; row < ROWS; row++) put("┊", col, row, "muted", 0.7);
        waves(random, put, 3, "·", "muted", 1);
      },
      near(put) { waves(random, put, 2, "∼", role, 0.9); },
    };
  } },
  { name: "aurora", moods: ["nature", "data"], make(random) {
    const first = pick(random, ACCENTS);
    const second = pick(random, ACCENTS);
    return {
      far(put) {
        for (let i = 0; i < 120; i++) put("·", randomInt(random, 0, COLS - 1), randomInt(random, 0, ROWS - 1), "text", 0.6);
        band(random, put, 6, 3, first, 0.9);
      },
      near(put) { band(random, put, 8, 2, second, 0.8); },
    };
  } },
  { name: "logs", moods: ["data", "machine"], make(random) {
    const role = pick(random, ["cyan", "ground", "platform"]);
    return {
      far(put, text) {
        for (let y = 14; y < SCREEN_HEIGHT; y += 16) {
          for (let x = randomInt(random, 0, 200); x < BACKDROP_WIDTH; x += randomInt(random, 380, 600)) text(pick(random, LOGS), x, y, 11, "muted", 1, true);
        }
      },
      near(put, text) {
        for (let i = 0; i < 12; i++) text(pick(random, LOGS), randomInt(random, 0, BACKDROP_WIDTH - 300), randomInt(random, 40, 400), 14, role, 0.7, true);
      },
    };
  } },
  { name: "forest", moods: ["nature"], make(random) {
    const role = pick(random, ["ground", "muted"]);
    return {
      far(put) { trees(random, put, 34, 4, 8, role, 0.7); },
      near(put) { trees(random, put, 12, 7, 12, role, 0.8); },
    };
  } },
  { name: "clouds", moods: ["nature", "machine"], make(random) {
    const role = pick(random, ["cyan", "platform", "text"]);
    const raining = random.next() < 0.5;
    return {
      far(put) { clouds(random, put, 10, "▒", 0.8, false, role); },
      near(put) { clouds(random, put, 5, "▓", 0.6, raining, role); },
    };
  } },
  { name: "bubbles", moods: ["nature", "data"], make(random) {
    const role = pick(random, ACCENTS);
    return {
      far(put) { for (let i = 0; i < 90; i++) put(pick(random, ["°", "○", "◦"]), randomInt(random, 0, COLS - 1), randomInt(random, 0, ROWS - 1), "muted", 1); },
      near(put, text) { for (let i = 0; i < 16; i++) text("◯", randomInt(random, 0, BACKDROP_WIDTH), randomInt(random, 30, 440), randomInt(random, 20, 56), role, 0.8); },
    };
  } },
  { name: "hills", moods: ["nature"], make(random) {
    const role = pick(random, ["ground", "cyan", "muted"]);
    return {
      far(put) { hills(random, put, 10, 4, "muted", 0.5); },
      near(put) { hills(random, put, 15, 3, role, 0.4); },
    };
  } },
  { name: "lattice", moods: ["data", "machine"], make(random) {
    const period = randomInt(random, 8, 16);
    const role = pick(random, ACCENTS);
    return {
      far(put) {
        for (let col = 0; col < COLS; col++) {
          for (let row = 0; row < ROWS; row++) {
            const rising = (col + row) % period === 0;
            const falling = (((col - row) % period) + period) % period === 0;
            if (rising && falling) put("╳", col, row, "muted", 1);
            else if (rising) put("╱", col, row, "muted", 0.7);
            else if (falling) put("╲", col, row, "muted", 0.7);
          }
        }
      },
      near(put) {
        for (let i = 0; i < 24; i++) {
          const row = randomInt(random, 0, ROWS - 1);
          const col = period * randomInt(random, 0, Math.floor(COLS / period)) - row;
          put("◆", col, row, role, 0.8);
        }
      },
    };
  } },
  { name: "gradient", moods: ["nature", "machine", "data"], make(random) {
    const role = pick(random, ACCENTS);
    const depth = randomInt(random, 6, 10);
    return {
      far(put) {
        for (let row = 0; row < depth; row++) {
          const shade = row < depth * 0.25 ? "▓" : row < depth * 0.55 ? "▒" : "░";
          for (let col = 0; col < COLS; col++) if (row < depth * 0.8 || random.next() < 0.5) put(shade, col, row, role, 0.7 * (1 - row / (depth + 2)));
        }
      },
      near(put) {
        for (let i = 0; i < 14; i++) {
          const row = randomInt(random, depth, depth + 6);
          const start = randomInt(random, 0, COLS - 1);
          for (let col = start; col < start + randomInt(random, 6, 20); col++) put("─", col, row, "muted", 0.8);
        }
      },
    };
  } },
  { name: "snow", moods: ["nature"], make(random) {
    return {
      far(put) { for (let i = 0; i < 260; i++) put(pick(random, ["·", "∙", "˙"]), randomInt(random, 0, COLS - 1), randomInt(random, 0, ROWS - 1), "text", 0.5 + random.next() * 0.5); },
      near(put) { for (let i = 0; i < 70; i++) put(pick(random, ["*", "⋆", "·"]), randomInt(random, 0, COLS - 1), randomInt(random, 0, ROWS - 1), "text", 0.8); },
    };
  } },
  { name: "orbits", moods: ["data", "nature"], make(random) {
    const role = pick(random, ACCENTS);
    const cx = randomInt(random, 40, COLS - 40);
    const cy = randomInt(random, 5, 9);
    return {
      far(put, text) {
        text("◉", cx * CELL_WIDTH + CELL_WIDTH / 2, cy * CELL_HEIGHT + CELL_HEIGHT / 2, 44, role, 0.8);
        for (let ring = 1; ring <= 4; ring++) {
          const rx = ring * 9;
          const ry = ring * 2.2;
          for (let t = 0; t < 2 * Math.PI; t += 1 / rx) put("·", Math.round(cx + rx * Math.cos(t)), Math.round(cy + ry * Math.sin(t)), "muted", 1);
        }
      },
      near(put) {
        for (let ring = 1; ring <= 4; ring++) {
          const t = random.next() * 2 * Math.PI;
          put("●", Math.round(cx + ring * 9 * Math.cos(t)), Math.round(cy + ring * 2.2 * Math.sin(t)), role, 1);
        }
      },
    };
  } },
  { name: "pylons", moods: ["machine"], make(random) {
    return {
      far(put) { pylons(random, put, randomInt(random, 28, 40), randomInt(random, 9, 12), 0.7); },
      near(put) { pylons(random, put, randomInt(random, 50, 70), randomInt(random, 13, 16), 0.7); },
    };
  } },
  { name: "bigtext", moods: ["data"], make(random) {
    const role = pick(random, ACCENTS);
    return {
      far(put) {
        for (let x = randomInt(random, 0, 10); x < COLS - 20; x += randomInt(random, 34, 50)) bigWord(put, pick(random, BIG_WORDS), x, randomInt(random, 1, 10), 1, "▓", "muted", 0.6);
      },
      near(put) { bigWord(put, pick(random, BIG_WORDS), randomInt(random, 0, COLS - 60), randomInt(random, 1, 4), 2, "░", role, 0.6); },
    };
  } },
];

function roundOpacity(opacity) {
  return Number((Math.round(Math.min(opacity, MAX_OPACITY) / OPACITY_STEP) * OPACITY_STEP).toFixed(2));
}

function drawLayer(draw, layerOpacity) {
  const cells = {};
  const texts = [];
  const put = (text, col, row, role, opacity) => {
    if (row < 0 || row >= ROWS) return;
    const wrapped = ((col % COLS) + COLS) % COLS;
    const shown = roundOpacity(opacity * layerOpacity);
    if (shown <= 0) return;
    cells[wrapped + "," + row] = { x: wrapped * CELL_WIDTH, y: row * CELL_HEIGHT, text, role, opacity: shown, glow: false };
  };
  const text = (content, x, y, size, role, opacity, fromLeft) => {
    const width = content.length * size * CHAR_WIDTH;
    const left = Math.round(fromLeft ? x : x - width / 2);
    const top = Math.round(y - (size * LINE_HEIGHT) / 2);
    const shown = roundOpacity(opacity * layerOpacity);
    for (const shift of [-BACKDROP_WIDTH, 0, BACKDROP_WIDTH]) {
      if (left + shift + width > 0 && left + shift < BACKDROP_WIDTH) texts.push({ x: left + shift, y: top, text: content, role, opacity: shown, size, glow: false, cell: false });
    }
  };
  draw(put, text);
  return mergeCells(Object.keys(cells).map(key => cells[key])).concat(texts);
}

export function buildBackdrop(family, random) {
  const layers = family.make(random);
  return {
    name: family.name,
    moods: family.moods,
    far: drawLayer(layers.far, FAR_OPACITY),
    near: drawLayer(layers.near, NEAR_OPACITY),
  };
}

export function backdropOffset(cameraX, parallax) {
  return -((cameraX * parallax) % BACKDROP_WIDTH);
}
