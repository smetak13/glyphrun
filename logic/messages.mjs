const SOURCES = {
  bug: { hit: "unhandled exception", kill: "resolved" },
  zombie: { hit: "<defunct> process attached", kill: "reaped" },
  spikes: { hit: "kernel: stack overflow", kill: null },
  ping: { hit: "request timed out", kill: "pong" },
  hang: { hit: "process not responding", kill: "kill -9" },
  cron: { hit: "cron: job executed (you)", kill: null },
  pipe: { hit: "broken pipe", kill: null },
  pointer: { hit: "use after free", kill: null },
  fork: { hit: "fork: resource unavailable", kill: "forked", smallKill: "wait()" },
  leak: { hit: "out of memory", kill: "free()" },
  pit: { hit: "/dev/null: write successful", kill: null },
  trace: { hit: "Call Trace: you+0x0/0x1", kill: null },
};
const NOT_ENEMIES = ["pit", "trace"];

export const EVENTS = {
  sudo: "sudo: privileges granted",
  alreadyRoot: "already root",
  checkpoint: "snapshot saved",
  seedCopied: "seed copied",
  nothingToPaste: "no seed in the clipboard",
  seedRejected: "not a seed: 8 hex digits, like 7f3a-91c2",
  bossDefeated: "kernel: rebooting…",
  effectsReduced: "under 50 fps · effects set to reduced",
};

export const ENEMY_SOURCES = Object.keys(SOURCES).filter(source => NOT_ENEMIES.indexOf(source) < 0);
export const KILLABLE_SOURCES = Object.keys(SOURCES).filter(source => SOURCES[source].kill !== null);

export function hitMessage(source) {
  return SOURCES[source].hit;
}

export function killMessage(source, small) {
  return small ? SOURCES[source].smallKill : SOURCES[source].kill;
}

export function bossHitMessage(hits, of) {
  return "core dumped (" + hits + "/" + of + ")";
}
