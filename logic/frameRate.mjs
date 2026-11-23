export const MIN_FPS = 50;
export const WINDOW_SECONDS = 2;
export const SLOW_WINDOWS = 2;
export const HITCH_SECONDS = 0.25;

export function createFrameWatcher() {
  return { seconds: 0, frames: 0, slowWindows: 0 };
}

export function resetFrameWatcher(watcher) {
  watcher.seconds = 0;
  watcher.frames = 0;
  watcher.slowWindows = 0;
}

export function watchFrame(watcher, frameSeconds) {
  if (frameSeconds <= 0 || frameSeconds >= HITCH_SECONDS) return false;
  watcher.seconds += frameSeconds;
  watcher.frames++;
  if (watcher.seconds < WINDOW_SECONDS) return false;
  const slow = watcher.frames / watcher.seconds < MIN_FPS;
  watcher.slowWindows = slow ? watcher.slowWindows + 1 : 0;
  watcher.seconds = 0;
  watcher.frames = 0;
  return watcher.slowWindows >= SLOW_WINDOWS;
}
