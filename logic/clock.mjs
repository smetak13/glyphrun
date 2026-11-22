export const STEP_SECONDS = 1 / 120;
export const MAX_FRAME_SECONDS = 0.25;

export function createClock() {
  return { pending: 0 };
}

export function stepsFor(clock, frameSeconds) {
  clock.pending += Math.min(Math.max(frameSeconds, 0), MAX_FRAME_SECONDS);
  const steps = Math.floor(clock.pending / STEP_SECONDS + 1e-9);
  clock.pending = Math.max(clock.pending - steps * STEP_SECONDS, 0);
  return steps;
}
