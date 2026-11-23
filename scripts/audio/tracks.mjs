export const LEVEL_TRACKS = [
  { file: "level-01", title: "boot sequence", bpm: 110, root: 57, scale: "minor", verse: [0, 5, 2, 6], bridge: [3, 5, 0, 6], bass: "octaves", arp: "up", drums: "four", lead: "square", seed: 101 },
  { file: "level-02", title: "night shift", bpm: 96, root: 54, scale: "minor", verse: [0, 3, 5, 4], bridge: [5, 6, 0, 0], bass: "syncopated", arp: "updown", drums: "synth", lead: "saw", seed: 202 },
  { file: "level-03", title: "stack trace", bpm: 118, root: 50, scale: "minor", verse: [0, 6, 5, 6], bridge: [3, 4, 5, 6], bass: "eighths", arp: "wide", drums: "four", lead: "pulse", seed: 303 },
  { file: "level-04", title: "merge conflict", bpm: 122, root: 52, scale: "harmonic", verse: [0, 5, 3, 4], bridge: [5, 3, 0, 4], bass: "octaves", arp: "up", drums: "breakbeat", lead: "square", seed: 404 },
  { file: "level-05", title: "null pointer dreams", bpm: 102, root: 48, scale: "dorian", verse: [0, 3, 0, 6], bridge: [2, 6, 3, 4], bass: "syncopated", arp: "wide", drums: "synth", lead: "saw", seed: 505 },
  { file: "level-06", title: "refactor run", bpm: 126, root: 55, scale: "minor", verse: [5, 6, 0, 0], bridge: [3, 4, 5, 6], bass: "octaves", arp: "updown", drums: "four", lead: "pulse", seed: 606 },
  { file: "level-07", title: "async await", bpm: 112, root: 47, scale: "minor", verse: [0, 4, 5, 3], bridge: [2, 6, 3, 4], bass: "eighths", arp: "up", drums: "breakbeat", lead: "square", seed: 707 },
  { file: "level-08", title: "segfault city", bpm: 116, root: 49, scale: "harmonic", verse: [0, 3, 5, 4], bridge: [3, 0, 5, 4], bass: "syncopated", arp: "wide", drums: "four", lead: "saw", seed: 808 },
  { file: "level-09", title: "coffee overflow", bpm: 108, root: 51, scale: "major", verse: [0, 4, 5, 3], bridge: [3, 4, 2, 5], bass: "octaves", arp: "updown", drums: "synth", lead: "pulse", seed: 909 },
  { file: "level-10", title: "localhost", bpm: 98, root: 57, scale: "dorian", verse: [0, 3, 0, 3], bridge: [6, 3, 2, 4], bass: "eighths", arp: "pulse8", drums: "synth", lead: "square", seed: 1010 },
];

export const BOSS_TRACKS = [
  { file: "boss-01", title: "kernel panic", bpm: 160, root: 52, scale: "phrygianDominant", verse: [0, 1, 0, 6], bridge: [5, 6, 1, 0], bass: "drive", arp: "up", drums: "boss", lead: "boss", boss: true, seed: 1111 },
  { file: "boss-02", title: "core dump", bpm: 156, root: 50, scale: "harmonic", verse: [0, 5, 3, 4], bridge: [3, 4, 5, 4], bass: "gallop", arp: "wide", drums: "boss", lead: "boss", boss: true, seed: 2222 },
  { file: "boss-03", title: "segmentation fault", bpm: 168, root: 48, scale: "minor", verse: [0, 0, 5, 6], bridge: [3, 5, 6, 4], bass: "drive", arp: "updown", drums: "boss", lead: "boss", boss: true, seed: 3333 },
  { file: "boss-04", title: "deadlock", bpm: 150, root: 53, scale: "harmonic", verse: [0, 3, 5, 4], bridge: [5, 4, 3, 4], bass: "gallop", arp: "up", drums: "boss", lead: "boss", boss: true, seed: 4444 },
  { file: "boss-05", title: "fatal exception", bpm: 164, root: 47, scale: "phrygian", verse: [0, 1, 6, 0], bridge: [5, 6, 5, 1], bass: "drive", arp: "wide", drums: "boss", lead: "boss", boss: true, seed: 5555 },
];
