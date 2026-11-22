import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPalette, gameColors, parseColors } from "../logic/theme.mjs";

const SHELL_ROLES = { foreground: "#EEEEEE", background: "#111111", accent: "#3366ff", urgent: "#ff0000", muted: "#777777" };

const NAMED_THEME = `
mode = "dark"
accent = "#dcd7ba"
muted = "#54546D"
background = "#1f1f28"
foreground = "#dcd7ba"
bright_foreground = "#ffffff"
red = "#c34043"
yellow = "#c0a36e"
green = "#76946a"
cyan = "#6a9589"
blue = "#7e9cd8"
magenta = "#957fb8"
bright_red = "#e82424"
bright_yellow = "#e6c384"
bright_green = "#98bb6c"
bright_cyan = "#7aa89f"
bright_blue = "#7fb4ca"
bright_magenta = "#938aa9"
`;

test("named theme keys fill the sixteen terminal slots in terminal order", () => {
  const palette = buildPalette(NAMED_THEME, SHELL_ROLES);

  assert.deepEqual(palette.slots, [
    "#1f1f28", "#c34043", "#76946a", "#c0a36e", "#7e9cd8", "#957fb8", "#6a9589", "#dcd7ba",
    "#54546d", "#e82424", "#98bb6c", "#e6c384", "#7fb4ca", "#938aa9", "#7aa89f", "#ffffff",
  ]);
});

test("numbered color keys fill their slots", () => {
  const palette = buildPalette('color0 = "#000001"\ncolor11 = "#00000b"\ncolor15 = "#00000f"', SHELL_ROLES);

  assert.equal(palette.slots[0], "#000001");
  assert.equal(palette.slots[11], "#00000b");
  assert.equal(palette.slots[15], "#00000f");
});

test("a numbered color key wins over the named key for the same slot", () => {
  const palette = buildPalette('red = "#aa0000"\ncolor1 = "#bb0000"', SHELL_ROLES);

  assert.equal(palette.slots[1], "#bb0000");
});

test("a missing bright color falls back to its normal color", () => {
  const palette = buildPalette('yellow = "#c0a36e"', SHELL_ROLES);

  assert.equal(palette.slots[11], "#c0a36e");
});

test("a theme without a palette falls back to the shell roles", () => {
  const palette = buildPalette("", SHELL_ROLES);

  assert.deepEqual(palette.slots, [
    "#111111", "#ff0000", "#3366ff", "#3366ff", "#3366ff", "#3366ff", "#3366ff", "#eeeeee",
    "#777777", "#ff0000", "#3366ff", "#3366ff", "#3366ff", "#3366ff", "#3366ff", "#eeeeee",
  ]);
  assert.equal(palette.background, "#111111");
  assert.equal(palette.foreground, "#eeeeee");
});

test("background and foreground keys win over color0 and color7", () => {
  const palette = buildPalette('color0 = "#000000"\nbackground = "#101010"\ncolor7 = "#cccccc"\nforeground = "#dddddd"', SHELL_ROLES);

  assert.equal(palette.background, "#101010");
  assert.equal(palette.foreground, "#dddddd");
});

test("lines without a six digit hex color are ignored", () => {
  const colors = parseColors('# comment\nmode = "dark"\nred = "#c3404380"\ngreen = "#76946A" # trailing\nbroken = #12\n');

  assert.deepEqual(colors, { green: "#76946a" });
});

test("game colors follow the palette table of the specification", () => {
  const colors = gameColors(buildPalette(NAMED_THEME, SHELL_ROLES));

  assert.deepEqual(colors, {
    background: "#1f1f28",
    text: "#dcd7ba",
    hexdump: "#54546d",
    muted: "#54546d",
    ground: "#76946a",
    platform: "#7e9cd8",
    block: "#957fb8",
    hero: "#e6c384",
    bit: "#c0a36e",
    cyan: "#6a9589",
    hostile: "#c34043",
    hostileAlt: "#e82424",
    hostileAlt2: "#938aa9",
  });
});

