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
};

export const EVENTS = {
  sudo: "sudo: privileges granted",
  alreadyRoot: "already root",
  checkpoint: "snapshot saved",
  seedCopied: "seed copied",
};

export const ENEMY_SOURCES = Object.keys(SOURCES).filter(source => source !== "pit");
export const KILLABLE_SOURCES = Object.keys(SOURCES).filter(source => SOURCES[source].kill !== null);

export function hitMessage(source) {
  return SOURCES[source].hit;
}

export function killMessage(source, small) {
  return small ? SOURCES[source].smallKill : SOURCES[source].kill;
}
