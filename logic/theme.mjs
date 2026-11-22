export const TERMINAL_NAMES = [
  "background",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "foreground",
  "muted",
  "bright_red",
  "bright_green",
  "bright_yellow",
  "bright_blue",
  "bright_magenta",
  "bright_cyan",
  "bright_foreground",
];

const FALLBACK_FOR_SLOT = [
  "background",
  "urgent",
  "accent",
  "accent",
  "accent",
  "accent",
  "accent",
  "foreground",
  "muted",
  1,
  2,
  3,
  4,
  5,
  6,
  7,
];

export function parseColors(text) {
  const colors = {};
  for (const line of String(text || "").split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*["']?(#[0-9A-Fa-f]{6})\b/);
    if (match) colors[match[1]] = match[2].toLowerCase();
  }
  return colors;
}

export function buildPalette(colorsText, shellRoles) {
  const colors = parseColors(colorsText);
  const slots = [];
  for (let slot = 0; slot < TERMINAL_NAMES.length; slot++) {
    const own = colors["color" + slot] || colors[TERMINAL_NAMES[slot]];
    const fallback = FALLBACK_FOR_SLOT[slot];
    slots.push(own || (typeof fallback === "number" ? slots[fallback] : String(shellRoles[fallback]).toLowerCase()));
  }
  return {
    slots,
    background: colors.background || slots[0],
    foreground: colors.foreground || slots[7],
  };
}

export function gameColors(palette) {
  const s = palette.slots;
  return {
    background: palette.background,
    text: palette.foreground,
    hexdump: s[8],
    muted: s[8],
    ground: s[2],
    platform: s[4],
    block: s[5],
    hero: s[11],
    bit: s[3],
    cyan: s[6],
    hostile: s[1],
    hostileAlt: s[9],
    hostileAlt2: s[13],
  };
}
