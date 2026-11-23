export function formatSeed(seed) {
  const hex = (seed >>> 0).toString(16).padStart(8, "0");
  return hex.slice(0, 4) + "-" + hex.slice(4);
}

export function parseSeed(text) {
  const match = /^([0-9a-f]{4})-?([0-9a-f]{4})$/i.exec(text.trim());
  return match ? parseInt(match[1] + match[2], 16) : null;
}
