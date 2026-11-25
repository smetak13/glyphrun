export const CELL_WIDTH = 12;
export const CELL_HEIGHT = 24;
export const CELL_FONT_SIZE = 20;

export function mergeCells(cells) {
  const groups = {};
  const keys = [];
  for (const cell of cells) {
    const key = cell.y + "|" + cell.role + "|" + cell.opacity + "|" + cell.glow;
    if (!groups[key]) {
      groups[key] = [];
      keys.push(key);
    }
    groups[key].push(cell);
  }
  const rows = [];
  for (const key of keys) {
    const group = groups[key].slice().sort((a, b) => a.x - b.x);
    let row = null;
    for (const cell of group) {
      if (row && cell.x < row.end) continue;
      if (row && cell.x === row.end) {
        row.glyph.text += cell.text;
      } else {
        row = { glyph: { x: cell.x, y: cell.y, text: cell.text, role: cell.role, opacity: cell.opacity, glow: cell.glow, size: CELL_FONT_SIZE, cell: true } };
        rows.push(row.glyph);
      }
      row.end = cell.x + CELL_WIDTH;
    }
  }
  return rows;
}
