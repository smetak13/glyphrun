export const FACE_WIDTH = 32;
export const FACE_ROWS = 7;
export const GLITCH_EVERY_SECONDS = 2.2;
export const GLITCH_SECONDS = 0.12;
export const FACE_BLINK_EVERY_SECONDS = 3.7;

const INNER = FACE_WIDTH - 2;
const SHADE = "░▒▓";
const GLITCH_FILL = "▒";
const EYE_ROW = 3;
const PUPIL_COLUMNS = [9, 21];
const HEX_SPAN = 8;

function blinking(time) {
  return (time + 0.5) % FACE_BLINK_EVERY_SECONDS > FACE_BLINK_EVERY_SECONDS - 0.14;
}

function padded(text) {
  return (text + " ".repeat(INNER)).slice(0, INNER);
}

function teeth(phase) {
  let text = "";
  for (let i = 0; i < 18; i++) text += (i + phase) % 2 ? "▄" : "▀";
  return text;
}

export function faceState(bossState) {
  if (bossState === "core") return "dumping";
  if (bossState === "crash" || bossState === "reboot" || bossState === "done") return "dead";
  return "angry";
}

function hexBytes(time) {
  const value = (Math.floor(time * 12) * 2654435761) >>> 0;
  return "0x" + value.toString(16).padStart(8, "0").slice(0, HEX_SPAN - 2);
}

function innerRows(state, time) {
  if (state === "angry") {
    const shut = blinking(time);
    const twitch = Math.floor(time * 4) % 7 === 0 ? 1 : 0;
    return [
      "▓▒░  ▀▄▄              ▄▄▀  ░▒▓",
      shut ? "░                            ░" : "░     ▄████▄      ▄████▄     ░",
      shut ? "      ▀▀▀▀▀▀      ▀▀▀▀▀▀      " : "      ██  ██      ██  ██      ",
      shut ? "" : "       ▀▀▀▀        ▀▀▀▀       ",
      "    ▄█" + teeth(twitch) + "█▄    ",
    ];
  }
  if (state === "dumping") {
    return [
      "▓▒░                        ░▒▓",
      "      ▀▄  ▄▀      ▀▄  ▄▀      ",
      "        ██          ██        ",
      "      ▄▀  ▀▄      ▄▀  ▀▄      ",
      "          ▄▀▀▀▀▀▀▀▀▄          ",
    ];
  }
  const blip = Math.floor(time * 14) % 50;
  const line = "▁".repeat(22).split("");
  if (blip < 21) {
    line[blip] = "╱";
    line[blip + 1] = "╲";
  }
  return ["░                            ░", "", "      ────          ────      ", "", "    " + line.join("") + "    "];
}

export function faceRows(state, time) {
  const bottom = state === "dumping"
    ? "╚" + "═".repeat(10) + "▌" + hexBytes(time) + "▐" + "═".repeat(10) + "╝"
    : "╚" + "═".repeat(INNER) + "╝";
  return ["╔" + "═".repeat(INNER) + "╗"].concat(innerRows(state, time).map(row => "║" + padded(row) + "║"), [bottom]);
}

function layerOf(state, ch, row, col) {
  if (SHADE.indexOf(ch) >= 0) return "shade";
  if (state === "dumping" && row >= 2 && row <= 4 && col > 4 && col < 27) return "eyes";
  if (state === "dumping" && row === FACE_ROWS - 1 && col > 10 && col < 21) return "eyes";
  if (state === "dead" && (ch === "─" || ch === "╱" || ch === "╲")) return "eyes";
  return "hostile";
}

function glitchSlot(time) {
  return Math.floor(time / GLITCH_EVERY_SECONDS);
}

export function faceGlitch(time) {
  if (time % GLITCH_EVERY_SECONDS >= GLITCH_SECONDS) return null;
  const slot = glitchSlot(time);
  return { row: 1 + (slot * 7919) % 5, shift: slot % 2 ? 1 : -2 };
}

export function faceLayers(state, time) {
  const rows = faceRows(state, time);
  const glitch = faceGlitch(time);
  const grids = { hostile: [], shade: [], eyes: [] };
  let glitched = "";
  rows.forEach((row, r) => {
    const cells = { hostile: "", shade: "", eyes: "" };
    const chars = row.split("");
    chars.forEach((ch, c) => {
      const layer = layerOf(state, ch, r, c);
      for (const name in cells) cells[name] += name === layer && (!glitch || glitch.row !== r) ? ch : " ";
    });
    if (state === "angry" && r === EYE_ROW && !blinking(time) && (!glitch || glitch.row !== r)) {
      const look = Math.floor(time / 1.3) % 2;
      const pupils = cells.eyes.split("");
      for (const col of PUPIL_COLUMNS) pupils[col + look] = "█";
      cells.eyes = pupils.join("");
    }
    if (glitch && glitch.row === r) {
      const slot = glitchSlot(time);
      glitched = chars.map((ch, c) => ch !== " " && (c * 13 + slot) % 5 === 0 ? GLITCH_FILL : ch).join("");
    }
    for (const name in cells) grids[name].push(cells[name]);
  });
  return {
    hostile: grids.hostile.join("\n"),
    shade: grids.shade.join("\n"),
    eyes: grids.eyes.join("\n"),
    glitch: glitched,
    glitchRow: glitch ? glitch.row : -1,
    glitchShift: glitch ? glitch.shift : 0,
  };
}

export function dropShadow(warning, warningSeconds) {
  const progress = warning > 0 ? 1 - warning / warningSeconds : 1;
  const late = progress > 0.7;
  return { text: late ? "▂" : "▁", width: 10 + 10 * progress, height: late ? 4 : 2, opacity: 0.35 + 0.5 * progress };
}

export function traceLabel(text, moving, time) {
  if (!moving) return text;
  return text.slice(0, -1) + "▒░#%"[Math.floor(time * 20) % 4];
}

export function corePulse(time) {
  return 1 + Math.sin(time * 6) * 0.05;
}

export function coreBits(time) {
  const bits = [];
  for (let i = 0; i < 3; i++) {
    const rise = (time * 0.7 + i / 3) % 1;
    bits.push({ text: (i + Math.floor(time * 3)) % 2 ? "1" : "0", x: -14 + i * 14, y: -20 - rise * 26, opacity: (1 - rise) * 0.6 });
  }
  return bits;
}

export function patchHop(time) {
  return -Math.abs(Math.sin(time * 7)) * 2;
}
