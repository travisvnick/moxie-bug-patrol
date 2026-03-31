// Grid and rendering constants for Moxie Bug Patrol

export const GRID_SIZE = 20;
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

// Background / ground color — warm desert sand
export const BG_COLOR = 0xDEB882;
export const BG_COLOR_CSS = "#DEB882";

// Moxie brand colors
export const MOXIE_BLUE = 0x0C77D8;
export const MOXIE_NAVY = 0x123250;

// Player start position (grid coords)
export const PLAYER_START_X = 10;
export const PLAYER_START_Y = 10;

// Convert grid coordinates to screen (isometric) pixel coordinates
export function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  const x = (gx - gy) * (TILE_WIDTH / 2);
  const y = (gx + gy) * (TILE_HEIGHT / 2);
  return { x, y };
}

// Convert screen pixel coordinates back to grid coordinates
export function screenToGrid(sx: number, sy: number): { gx: number; gy: number } {
  const gx = (sx / (TILE_WIDTH / 2) + sy / (TILE_HEIGHT / 2)) / 2;
  const gy = (sy / (TILE_HEIGHT / 2) - sx / (TILE_WIDTH / 2)) / 2;
  return { gx, gy };
}
