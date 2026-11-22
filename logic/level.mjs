import { TILE, SCREEN_ROWS, SCREEN_WIDTH } from "./screen.mjs";

export const SECTION_WIDTH = SCREEN_WIDTH;
export const SECTION_OVERHANG = 6 * TILE;

const GROUND = "#";
const PLATFORM = "=";
const BLOCK = "B";
const HERO = "@";
const CHECKPOINT = "C";
const EXIT = "X";
const BITS = "01";
const SUDO_BIT = "S";
const SUDO_BIT_TEXT = "1";
const BOTTOM_ROW = SCREEN_ROWS - 1;
const SPIKES = "^";
const ENEMY_KINDS = { b: "bug", z: "zombie", o: "ping", v: "hang" };

export function parseLevel(rows) {
  if (rows.length !== SCREEN_ROWS) throw new Error("a level has " + SCREEN_ROWS + " rows, got " + rows.length);
  const cols = rows[0].length;
  const level = { cols, rows, start: null, checkpoint: null, exit: null, bits: [], enemies: [] };
  rows.forEach((line, row) => {
    if (line.length !== cols) throw new Error("level row " + row + " has " + line.length + " columns, expected " + cols);
    for (let col = 0; col < cols; col++) {
      const tile = line[col];
      if (tile === HERO) level.start = { col, row };
      else if (tile === CHECKPOINT) level.checkpoint = { col, row };
      else if (tile === EXIT) level.exit = { col, row };
      else if (BITS.indexOf(tile) >= 0) level.bits.push({ col, row, text: tile, sudo: false });
      else if (tile === SUDO_BIT) level.bits.push({ col, row, text: SUDO_BIT_TEXT, sudo: true });
      else if (ENEMY_KINDS[tile]) level.enemies.push({ kind: ENEMY_KINDS[tile], col, row });
      else if (tile === SPIKES && line[col - 1] !== SPIKES) level.enemies.push({ kind: "spikes", col, row, tiles: spikeRun(line, col) });
    }
  });
  return level;
}

function spikeRun(line, col) {
  let tiles = 1;
  while (line[col + tiles] === SPIKES) tiles++;
  return tiles;
}

export function tileAt(level, col, row) {
  if (row < 0 || row >= SCREEN_ROWS || col < 0 || col >= level.cols) return ".";
  return level.rows[row][col];
}

function fillGlyph(col, row) {
  return (Math.imul(col, 73856093) ^ Math.imul(row, 19349663)) & 4 ? "░" : "▒";
}

export function levelGlyphs(level) {
  const glyphs = [];
  const add = (x, y, text, role, size) => glyphs.push({ x, y, text, role, size });
  for (let row = 0; row < SCREEN_ROWS; row++) {
    for (let col = 0; col < level.cols; col++) {
      const tile = tileAt(level, col, row);
      if (tile === GROUND) {
        if (tileAt(level, col, row - 1) === GROUND) add(col * TILE, row * TILE - 2, fillGlyph(col, row), "muted", 26);
        else add(col * TILE, row * TILE - 2, "▀", "ground", 26);
      } else if (tile === BLOCK) {
        add(col * TILE, row * TILE - 2, "▓", "block", 26);
      } else if (tile === PLATFORM && tileAt(level, col - 1, row) !== PLATFORM) {
        let length = 1;
        while (tileAt(level, col + length, row) === PLATFORM) length++;
        add(col * TILE, row * TILE + 2, "[" + "=".repeat(length * 2 - 2) + "]", "platform", 20);
      }
      if (row === BOTTOM_ROW && tile !== GROUND && tileAt(level, col - 1, row) === GROUND) {
        add(col * TILE, row * TILE, "/dev/null", "hostile", 12);
      }
    }
  }
  if (level.exit) addExit(add, level.exit);
  return glyphs;
}

export function checkpointGlyphs(checkpoint, lit) {
  const role = lit ? "cyan" : "muted";
  const x = checkpoint.col * TILE;
  const glyphs = [];
  for (let row = checkpoint.row - 2; row <= checkpoint.row; row++) glyphs.push({ x, y: row * TILE, text: "│", role, size: 24 });
  glyphs.push({ x: x + 10, y: (checkpoint.row - 2) * TILE - 4, text: lit ? "▶" : "▷", role, size: 18 });
  return glyphs;
}

function addExit(add, { col, row }) {
  const x = col * TILE - 18;
  const y = (row - 5) * TILE;
  add(x, y, "┌──────┐", "cyan", 16);
  for (let i = 1; i <= 8; i++) add(x, y + i * 16, "│      │", "cyan", 16);
  add(x + 16, y + 56, "exit", "cyan", 13);
  add(x + 30, y + 74, "0", "cyan", 13);
}

export function levelSections(level) {
  const sections = [];
  const count = Math.ceil((level.cols * TILE) / SECTION_WIDTH);
  for (let i = 0; i < count; i++) sections.push({ x: i * SECTION_WIDTH, glyphs: [] });
  for (const glyph of levelGlyphs(level)) {
    const section = sections[Math.min(Math.floor(glyph.x / SECTION_WIDTH), count - 1)];
    section.glyphs.push({ x: glyph.x - section.x, y: glyph.y, text: glyph.text, role: glyph.role, size: glyph.size });
  }
  return sections;
}
