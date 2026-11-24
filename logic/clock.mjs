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

export const SMOOTHING_FRAMES = 8;
export const SNAP_SECONDS = 0.0005;

export function createFrameTimer() {
  return { lastMs: null, recent: [] };
}

export function measureFrame(timer, nowMs) {
  const seconds = timer.lastMs === null ? 0 : Math.min(Math.max((nowMs - timer.lastMs) / 1000, 0), MAX_FRAME_SECONDS);
  timer.lastMs = nowMs;
  return seconds;
}

export function smoothFrame(timer, seconds) {
  if (seconds <= 0) return 0;
  timer.recent.push(seconds);
  if (timer.recent.length > SMOOTHING_FRAMES) timer.recent.shift();
  const mean = timer.recent.reduce((sum, value) => sum + value, 0) / timer.recent.length;
  const steps = Math.round(mean / STEP_SECONDS);
  return steps > 0 && Math.abs(mean - steps * STEP_SECONDS) < SNAP_SECONDS ? steps * STEP_SECONDS : mean;
}
