export const PAUSE_ITEMS = ["Resume", "Controls", "Copy seed", "Main menu"];
export const GAME_OVER_ITEMS = ["Retry this seed from level 1", "New seed", "Copy seed", "Main menu"];
export const VICTORY_ITEMS = ["New run", "Copy seed", "Main menu"];
export const SCORE_ACTIONS = ["play", "copy"];
export const SCORE_TABS = ["score", "time"];
export const CONTROLS = [
  { keys: "←  →", action: "move" },
  { keys: "space  ↑", action: "jump  (hold for higher)" },
  { keys: "shift", action: "run  (hold)" },
  { keys: "p", action: "pause" },
  { keys: "esc", action: "menu" },
];
export const SETTINGS = ["effects", "music", "sound", "mute"];

export function canContinue(run) {
  return run !== null && !run.over && !run.won;
}

export function mainMenuItems(run) {
  const items = ["New run", "Enter seed", "High scores", "Controls", "Settings"];
  return canContinue(run) ? ["Continue"].concat(items) : items;
}

export function moveIndex(index, step, count) {
  return (index + step + count) % count;
}

export const VOLUME_STEPS = 10;

export function stepVolume(volume, direction) {
  const steps = Math.round(volume * VOLUME_STEPS) + direction;
  return Math.min(Math.max(steps, 0), VOLUME_STEPS) / VOLUME_STEPS;
}

export function percent(volume) {
  return Math.round(volume * 100) + "%";
}
