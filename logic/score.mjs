export const BIT_POINTS = 10;
export const KILL_POINTS = 100;
export const SMALL_FORK_POINTS = 50;
export const LEAK_POINTS = 200;
export const SUDO_POINTS = 250;
export const ALREADY_ROOT_POINTS = 500;
export const BOSS_HIT_POINTS = 1000;
export const BOSS_DEFEATED_POINTS = 5000;
export const PAR_SECONDS = 60;
export const TIME_BONUS_PER_SECOND = 20;

export function killPoints(source, small) {
  if (source === "leak") return LEAK_POINTS;
  if (source === "fork" && small) return SMALL_FORK_POINTS;
  return KILL_POINTS;
}

export function timeBonus(seconds) {
  return Math.max(Math.floor(PAR_SECONDS - seconds), 0) * TIME_BONUS_PER_SECOND;
}
