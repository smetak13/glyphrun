export const PAUSE_ITEMS = ["Resume", "Copy seed", "Main menu"];
export const GAME_OVER_ITEMS = ["Retry this seed from level 1", "New seed", "Copy seed", "Main menu"];
export const VICTORY_ITEMS = ["New run", "Copy seed", "Main menu"];
export const SCORE_ACTIONS = ["play", "copy"];

export function canContinue(run) {
  return run !== null && !run.over && !run.won;
}

export function mainMenuItems(run) {
  const items = ["New run", "Enter seed", "High scores", "Settings"];
  return canContinue(run) ? ["Continue"].concat(items) : items;
}

export function moveIndex(index, step, count) {
  return (index + step + count) % count;
}
