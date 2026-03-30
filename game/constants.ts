// Tile dimensions (2:1 isometric ratio)
export const TILE_HW = 48;   // half-width of one tile
export const TILE_HH = 24;   // half-height of one tile
export const TILE_W = TILE_HW * 2;
export const TILE_H = TILE_HH * 2;

// Grid
export const GRID_SIZE = 14;
export const GRID_ORIGIN_X = 800;
export const GRID_ORIGIN_Y = 200;

// Canvas
export const CANVAS_W = 1600;
export const CANVAS_H = 900;

// Colors (as numbers for Phaser)
export const COL_SKY       = 0x87CEEB;
export const COL_SKY_DEEP  = 0xB8D4E8;
export const COL_SAND      = 0xE8C99A;
export const COL_SAND_DARK = 0xD4A76A;
export const COL_TERRACOTTA= 0xC4613A;
export const COL_SAGE      = 0x8FAF7E;
export const COL_MOXIE     = 0x2D6A4F;
export const COL_STUCCO    = 0xF0E0C0;
export const COL_CACTUS    = 0x4A7C59;

/**
 * Convert grid coordinates to screen (isometric projection).
 * Tile (gx, gy) has its center-bottom point at the returned position.
 */
export function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  return {
    x: GRID_ORIGIN_X + (gx - gy) * TILE_HW,
    y: GRID_ORIGIN_Y + (gx + gy) * TILE_HH,
  };
}

/**
 * Convert a screen-space direction vector to grid-space direction vector.
 * Useful for mapping keyboard input to world movement.
 */
export function screenDirToGrid(sdx: number, sdy: number): { gx: number; gy: number } {
  return {
    gx: sdx / TILE_HW * 0.5 + sdy / TILE_HH * 0.5,
    gy: sdy / TILE_HH * 0.5 - sdx / TILE_HW * 0.5,
  };
}

/**
 * Convert a world screen position back to grid coordinates (inverse of gridToScreen).
 */
export function screenToGrid(sx: number, sy: number): { gx: number; gy: number } {
  const u = (sx - GRID_ORIGIN_X) / TILE_HW;
  const v = (sy - GRID_ORIGIN_Y) / TILE_HH;
  return {
    gx: (u + v) / 2,
    gy: (v - u) / 2,
  };
}
