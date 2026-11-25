import { pick, randomInt, hashPoint } from "./random.mjs";

export const ACCENT_OPACITY = 0.75;
export const DECOR_OPACITY = 0.3;
export const DECOR_DROP = 6;
export const SURFACES = ["▀", "█"];
export const BLOCK_STYLES = ["shade", "solid", "brackets", "chip", "box", "crate"];
export const PLATFORM_STYLES = [["[", "=", "]"], ["╞", "═", "╡"], ["<", "=", ">"], ["├", "┄", "┤"], ["▕", "━", "▏"], ["╘", "═", "╛"], ["(", "─", ")"], ["╟", "─", "╢"]];
const ACCENTS = ["cyan", "platform", "block", "ground"];
const KEYS = "QWERTYUIOPASDFGHJKLZXCVBNM";
const GAMER_KEYS = "WASD";
const SOURCES = [
  "fn deploy(env) { if env == prod { yolo(); } return ok; } ",
  "SELECT * FROM users WHERE id = $1; -- TODO index ",
  "for (;;) { malloc(4096); } /* leak? never */ ",
  "git push --force origin main && echo shipped ",
  "#include <stdio.h> int main(void) { return segv; } ",
  "const fix = await chatgpt(stacktrace); // trust me ",
];

function look(text, role, opacity) {
  return { text, role, opacity };
}

function muted(text) {
  return look(text, "muted", 1);
}

function accent(text, role) {
  return look(text, role, ACCENT_OPACITY);
}

function decoration(text, role) {
  return look(text, role, DECOR_OPACITY);
}

function choose(items, h) {
  return items[Math.floor(h * items.length)];
}

export const TERRAIN_FAMILIES = [
  { name: "strata", moods: ["nature"], blocks: ["shade", "box", "brackets"], make(random) {
    const ramp = pick(random, [["▓", "▒", "░"], ["█", "▓", "▒", "░"], ["▓", "▒"], ["█", "▓", "▒"]]);
    const band = randomInt(random, 3, 6);
    const pebbles = random.next() * 0.1;
    const salt = randomInt(random, 1, 1e6);
    return {
      decor: pick(random, [null, decoration('"', "ground"), decoration("„", "ground")]),
      fill(x, row, depth) {
        if (depth % band === 0) return accent("≈", "ground");
        if (hashPoint(x, row, salt) < pebbles) return muted("•");
        return muted(ramp[Math.min(depth - 1, ramp.length - 1)]);
      },
    };
  } },
  { name: "bricks", moods: ["machine"], blocks: ["box", "crate", "solid"], surfaces: SURFACES, make(random) {
    const width = randomInt(random, 2, 5);
    const body = pick(random, ["▓", "▒", "█"]);
    const mortar = pick(random, ["│", "┃", "▕", "╎"]);
    const mortarRole = pick(random, ["muted", "ground", "block"]);
    return {
      fill(x, row) {
        const offset = (row % 2) * Math.ceil(width / 2);
        if ((x + offset) % (width + 1) === 0) return mortarRole === "muted" ? muted(mortar) : accent(mortar, mortarRole);
        return muted(body);
      },
    };
  } },
  { name: "circuit", moods: ["data", "machine"], blocks: ["chip", "box", "brackets"], make(random) {
    const role = pick(random, ["cyan", "platform", "block"]);
    const density = 0.2 + 0.25 * random.next();
    const via = pick(random, ["○", "◦", "●"]);
    const base = pick(random, ["▒", "▓"]);
    const salt = randomInt(random, 1, 1e6);
    return {
      decor: pick(random, [null, decoration("╻", role)]),
      fill(x, row) {
        const across = hashPoint(0, row, salt) < density;
        const down = hashPoint(x, 0, salt + 1) < 0.12;
        if (across && down) return muted("┼");
        if (across) {
          if (hashPoint(x, row, salt + 2) < 0.08) return accent(via, role);
          if (hashPoint(x, row, salt + 3) < 0.04) return accent("⊡", role);
          return muted("─");
        }
        if (down) return muted("│");
        return muted(base);
      },
    };
  } },
  { name: "racks", moods: ["machine", "data"], blocks: ["box", "brackets", "chip"], surfaces: SURFACES, make(random) {
    const unit = randomInt(random, 5, 9);
    const led = pick(random, ["▪", "•", "■", "◆"]);
    const role = pick(random, ["cyan", "ground", "platform"]);
    const slot = pick(random, ["▒", "▓", "≡"]);
    const salt = randomInt(random, 1, 1e6);
    return {
      decor: pick(random, [null, decoration("╻", "muted")]),
      fill(x, row) {
        const u = x % unit;
        if (u === 0) return muted("▐");
        if (u === unit - 1) return muted("▌");
        if (u <= 2) return hashPoint(x, row, salt) < 0.45 ? accent(led, role) : muted(led);
        return muted(slot);
      },
    };
  } },
  { name: "crystal", moods: ["nature", "data"], blocks: ["chip", "shade", "box"], make(random) {
    const base = pick(random, ["▒", "▓"]);
    const density = 0.06 + 0.12 * random.next();
    const role = pick(random, ["cyan", "block", "platform"]);
    const salt = randomInt(random, 1, 1e6);
    return {
      decor: decoration("◦", role),
      fill(x, row, depth) {
        if (hashPoint(x, row, salt) < density) return accent(choose(["◆", "◇", "◈"], hashPoint(x, row, salt + 1)), role);
        return muted(depth > 3 ? "▓" : base);
      },
    };
  } },
  { name: "roots", moods: ["nature"], blocks: ["shade", "brackets", "crate"], make(random) {
    const base = pick(random, ["▒", "▓"]);
    const slant = pick(random, [-1, 0, 1]);
    const root = slant < 0 ? "╱" : slant > 0 ? "╲" : "│";
    const salt = randomInt(random, 1, 1e6);
    return {
      decor: pick(random, [decoration('"', "ground"), decoration("„", "ground"), decoration("ˇ", "ground")]),
      decorRate: 0.75,
      fill(x, row) {
        if (hashPoint(x - row * slant, 0, salt) < 0.09) return accent(root, "ground");
        if (hashPoint(x, row, salt + 1) < 0.04) return muted("●");
        return muted(base);
      },
    };
  } },
  { name: "punch", moods: ["data"], blocks: ["chip", "box"], make(random) {
    const holes = pick(random, [["▪", "▫"], ["■", "□"], ["●", "○"]]);
    const unit = randomInt(random, 6, 12);
    const role = pick(random, ACCENTS);
    const salt = randomInt(random, 1, 1e6);
    return {
      fill(x, row) {
        if (x % unit === unit - 1) return muted("│");
        const h = hashPoint(x, row, salt);
        if (h < 0.08) return accent(holes[0], role);
        return muted(h < 0.45 ? holes[0] : holes[1]);
      },
    };
  } },
  { name: "cables", moods: ["machine"], blocks: ["crate", "solid", "box"], make(random) {
    const role = pick(random, ACCENTS);
    const salt = randomInt(random, 1, 1e6);
    return {
      decor: pick(random, [null, decoration("∩", role)]),
      fill(x, row) {
        const k = hashPoint(0, row, salt);
        if (hashPoint(x, row, salt + 1) < 0.03) return accent("╪", role);
        const bundle = choose(["═", "─", "≡", "━", "┄"], k);
        return row % 5 === 0 ? accent(bundle, role) : muted(bundle);
      },
    };
  } },
  { name: "glitch", moods: ["data"], blocks: ["shade", "chip", "solid"], surfaces: ["▀", "▀", "█"], make(random) {
    const set = pick(random, [["▓", "▒", "░", "█"], ["▚", "▞", "▙", "▟", "▛", "▜"], ["▓", "▚", "░", "▞", "▒"]]);
    const role = pick(random, ["cyan", "block", "platform"]);
    const salt = randomInt(random, 1, 1e6);
    return {
      fill(x, row) {
        const text = choose(set, hashPoint(x, row, salt + 1));
        return hashPoint(x, row, salt) < 0.03 ? accent(text, role) : muted(text);
      },
    };
  } },
  { name: "plates", moods: ["machine"], blocks: ["crate", "box", "brackets"], make(random) {
    const width = randomInt(random, 4, 8);
    const height = randomInt(random, 2, 3);
    const hazard = random.next() < 0.5;
    const inner = pick(random, ["▒", "▓"]);
    return {
      fill(x, row, depth) {
        if (hazard && depth === 1) return accent("╱", "ground");
        const d = depth - (hazard ? 2 : 1);
        const u = x % width;
        const v = d % height;
        const top = v === 0;
        const bottom = v === height - 1;
        const left = u === 0;
        const right = u === width - 1;
        if (top && left) return muted("┌");
        if (top && right) return muted("┐");
        if (bottom && left) return muted("└");
        if (bottom && right) return muted("┘");
        if (top || bottom) return muted("─");
        if (left || right) return muted("│");
        return muted(u === 1 || u === width - 2 ? "°" : inner);
      },
    };
  } },
  { name: "honeycomb", moods: ["data", "nature"], blocks: ["chip", "box"], make(random) {
    const inner = pick(random, ["▒", "▓"]);
    const role = pick(random, ACCENTS);
    const salt = randomInt(random, 1, 1e6);
    const pattern = [["╲", "_", "_", "╱", inner, inner], ["╱", inner, inner, "╲", "_", "_"]];
    return {
      fill(x, row) {
        const text = pattern[row % 2][x % 6];
        if (text === inner && hashPoint(Math.floor(x / 6), row, salt) < 0.15) return accent("▒", role);
        return muted(text);
      },
    };
  } },
  { name: "dunes", moods: ["nature"], blocks: ["shade", "brackets"], make(random) {
    const period = randomInt(random, 4, 8);
    const slope = pick(random, [1, 2, -1, -2]);
    const role = pick(random, ["ground", "cyan"]);
    const salt = randomInt(random, 1, 1e6);
    return {
      decor: pick(random, [null, decoration("‚", "ground")]),
      fill(x, row) {
        if (hashPoint(x, row, salt) < 0.05) return accent("∴", role);
        const phase = (((x + row * slope) % period) + period) % period;
        return muted(phase < period / 2 ? "▓" : "▒");
      },
    };
  } },
  { name: "code", moods: ["data"], blocks: ["box", "brackets", "shade"], make(random) {
    const source = pick(random, SOURCES);
    const role = pick(random, ACCENTS);
    return {
      fill(x, row) {
        const text = source[(row * 61 + x) % source.length];
        if (text === " ") return muted("▒");
        return "{}();".indexOf(text) >= 0 ? accent(text, role) : muted(text);
      },
    };
  } },
  { name: "cobbles", moods: ["nature", "machine"], blocks: ["shade", "crate"], make(random) {
    const width = randomInt(random, 3, 5);
    const body = pick(random, ["▓", "▒"]);
    return {
      decor: pick(random, [null, decoration('"', "ground")]),
      fill(x, row) {
        const u = (x + (row % 2) * 2) % width;
        if (u === 0) return muted("(");
        if (u === width - 1) return muted(")");
        return muted(body);
      },
    };
  } },
  { name: "keyboard", moods: ["data", "machine"], blocks: ["box", "chip"], surfaces: SURFACES, make(random) {
    const role = pick(random, ACCENTS);
    const salt = randomInt(random, 1, 1e6);
    return {
      fill(x, row) {
        const shifted = x + (row % 3);
        const key = Math.floor(shifted / 3);
        const letter = KEYS[Math.floor(hashPoint(key, row, salt) * KEYS.length)];
        const text = shifted % 3 === 0 ? "[" : shifted % 3 === 2 ? "]" : letter;
        return GAMER_KEYS.indexOf(letter) >= 0 ? accent(text, role) : muted(text);
      },
    };
  } },
  { name: "pillars", moods: ["machine", "nature"], blocks: ["brackets", "box", "shade"], make(random) {
    const unit = randomInt(random, 4, 7);
    const wall = pick(random, ["▒", "▓"]);
    const column = pick(random, ["█", "║"]);
    return {
      decor: pick(random, [null, decoration('"', "ground")]),
      fill(x, row, depth) {
        if (depth === 1) return muted("▓");
        return muted(x % unit < 2 ? column : wall);
      },
    };
  } },
  { name: "barcode", moods: ["data"], blocks: ["solid", "chip"], make(random) {
    const role = pick(random, ACCENTS);
    const salt = randomInt(random, 1, 1e6);
    return {
      fill(x) {
        const text = choose(["█", "▌", "▐", "┃", "▓"], hashPoint(x, 0, salt));
        return hashPoint(x, 1, salt) < 0.06 ? accent(text, role) : muted(text);
      },
    };
  } },
  { name: "conveyor", moods: ["machine"], blocks: ["crate", "box"], make(random) {
    const unit = randomInt(random, 5, 9);
    const role = pick(random, ACCENTS);
    const arrows = pick(random, [["»", "«"], ["›", "‹"], [">", "<"]]);
    const base = pick(random, ["▒", "▓"]);
    const salt = randomInt(random, 1, 1e6);
    return {
      fill(x, row, depth) {
        if (depth % 2 === 0) return muted(base);
        if (x % unit === 0) return accent("●", role);
        return muted(hashPoint(0, row, salt) < 0.5 ? arrows[0] : arrows[1]);
      },
    };
  } },
  { name: "braille", moods: ["data"], blocks: ["shade", "chip"], make(random) {
    const density = 0.7 + 0.25 * random.next();
    const role = pick(random, ACCENTS);
    const salt = randomInt(random, 1, 1e6);
    return {
      fill(x, row) {
        let dots = 0;
        for (let bit = 0; bit < 8; bit++) if (hashPoint(x * 8 + bit, row, salt) < density) dots |= 1 << bit;
        const text = String.fromCharCode(0x2800 + (dots || 0xff));
        return hashPoint(x, row, salt + 1) < 0.04 ? accent(text, role) : muted(text);
      },
    };
  } },
  { name: "moss", moods: ["nature"], blocks: ["shade", "brackets", "crate"], make(random) {
    const base = pick(random, ["▒", "▓"]);
    const salt = randomInt(random, 1, 1e6);
    return {
      decor: decoration('"', "ground"),
      decorRate: 0.6,
      fill(x, row, depth) {
        if (depth === 1) return accent(hashPoint(x, row, salt) < 0.5 ? "▓" : "▒", "ground");
        return muted(hashPoint(x, row, salt + 1) < 0.12 ? "●" : base);
      },
    };
  } },
];

export function blockLook(style, isLeft, neighbours) {
  const top = !neighbours.up;
  const bottom = !neighbours.down;
  const edge = isLeft ? !neighbours.left : !neighbours.right;
  const block = (text, opacity) => look(text, "block", opacity === undefined ? 1 : opacity);
  if (style === "shade") return block("▓");
  if (style === "solid") return block("█", 0.85);
  if (style === "chip") return block("⊡");
  if (style === "brackets") return edge ? block(isLeft ? "▐" : "▌") : block("█", 0.8);
  const corners = style === "box" ? ["╔", "╗", "╚", "╝", "║", "═", "▒"] : ["┌", "┐", "└", "┘", "│", "─", isLeft ? "╲" : "╱"];
  if (edge) {
    if (top && bottom) return block(isLeft ? "[" : "]");
    if (top) return block(isLeft ? corners[0] : corners[1]);
    if (bottom) return block(isLeft ? corners[2] : corners[3]);
    return block(corners[4]);
  }
  return top || bottom ? block(corners[5]) : block(corners[6], 0.8);
}

export function buildTerrain(family, random) {
  const terrain = family.make(random);
  terrain.name = family.name;
  terrain.moods = family.moods;
  terrain.surface = look(pick(random, family.surfaces || ["▀"]), "ground", 1);
  terrain.blocks = pick(random, family.blocks);
  terrain.platform = pick(random, PLATFORM_STYLES);
  terrain.salt = randomInt(random, 1, 1e6);
  if (!terrain.decor) terrain.decor = null;
  if (!terrain.decorRate) terrain.decorRate = 0.35;
  return terrain;
}
