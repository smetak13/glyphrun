import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { encodeWav } from "./audio/synth.mjs";
import { EFFECT_NAMES, renderEffect } from "./audio/effects.mjs";
import { renderTrack } from "./audio/music.mjs";
import { LEVEL_TRACKS, BOSS_TRACKS } from "./audio/tracks.mjs";

const audioDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "audio");
const effectsDir = path.join(audioDir, "sfx");
const musicDir = path.join(audioDir, "music");
fs.mkdirSync(effectsDir, { recursive: true });
fs.mkdirSync(musicDir, { recursive: true });

for (const name of EFFECT_NAMES) {
  fs.writeFileSync(path.join(effectsDir, name + ".wav"), encodeWav(renderEffect(name), 1));
  console.log("sfx   " + name);
}

for (const track of [...LEVEL_TRACKS, ...BOSS_TRACKS]) {
  const buffer = renderTrack(track);
  const temporary = path.join(os.tmpdir(), "glyphrun-" + track.file + ".wav");
  fs.writeFileSync(temporary, encodeWav(buffer, 2));
  const target = path.join(musicDir, track.file + ".ogg");
  const encoding = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", temporary, "-fflags", "+bitexact", "-flags:a", "+bitexact", "-c:a", "libvorbis", "-q:a", "3", target], { encoding: "utf8" });
  fs.unlinkSync(temporary);
  if (encoding.status !== 0) {
    process.stderr.write(encoding.stderr || "Could not encode " + target + "\n");
    process.exit(1);
  }
  console.log("music " + track.file + "  " + track.title + "  " + (buffer.length / 44100).toFixed(1) + " s");
}
