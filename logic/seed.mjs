export function formatSeed(seed) {
  const hex = (seed >>> 0).toString(16).padStart(8, "0");
  return hex.slice(0, 4) + "-" + hex.slice(4);
}
