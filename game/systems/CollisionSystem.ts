import { GRID_SIZE } from "../constants";

/**
 * Tile-based collision grid. Each cell in the 20×20 grid is either
 * walkable (false) or blocked (true). Player and bugs check this
 * before moving to avoid walking through solid objects.
 *
 * Collision uses axis-aligned edge probes rather than circle-AABB tests.
 * This avoids false positives at tile corners where diagonal blocked tiles
 * share edges at integer grid positions.
 */

// Half-width of the entity's collision box along each axis.
// Smaller values let the player navigate tighter gaps between obstacles.
const PLAYER_HW = 0.15;
const BUG_HW = 0.15;

// Singleton grid — rebuilt every time the scene creates (restart-safe).
let grid: boolean[][] = [];

function makeGrid(): boolean[][] {
  const g: boolean[][] = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    g[x] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      g[x][y] = false;
    }
  }
  return g;
}

/** Reset the grid (call at scene create before registering objects). */
export function resetCollisionGrid(): void {
  grid = makeGrid();
}

/** Mark a single tile as blocked. */
export function registerBlocked(gx: number, gy: number): void {
  if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
    grid[gx][gy] = true;
  }
}

/** Mark a rectangular footprint of tiles as blocked. */
export function registerBlockedRect(gx: number, gy: number, w: number, h: number): void {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      registerBlocked(gx + dx, gy + dy);
    }
  }
}

/** Check if a specific integer tile is blocked. */
export function isTileBlocked(tx: number, ty: number): boolean {
  if (tx < 0 || tx >= GRID_SIZE || ty < 0 || ty >= GRID_SIZE) return true;
  return grid[tx][ty];
}

/**
 * Check if an axis-aligned box at (cx, cy) with half-width hw overlaps
 * any blocked tile. Only checks the four cardinal-direction edge probes
 * plus the center tile — never the diagonals — so entities don't snag
 * on tile corners.
 */
function boxOverlapsBlocked(cx: number, cy: number, hw: number): boolean {
  // Center tile
  if (isTileBlocked(Math.floor(cx), Math.floor(cy))) return true;
  // Cardinal edges only — no diagonals to avoid false positives at tile corners
  if (isTileBlocked(Math.floor(cx + hw), Math.floor(cy))) return true;
  if (isTileBlocked(Math.floor(cx - hw), Math.floor(cy))) return true;
  if (isTileBlocked(Math.floor(cx), Math.floor(cy + hw))) return true;
  if (isTileBlocked(Math.floor(cx), Math.floor(cy - hw))) return true;
  return false;
}

/**
 * Resolve player movement with wall sliding.
 *
 * Try the full move first. If blocked, try each axis independently.
 * Returns the final position the player can reach.
 */
export function resolvePlayerMove(
  oldGX: number, oldGY: number,
  newGX: number, newGY: number,
): { gx: number; gy: number } {
  // Full move
  if (!boxOverlapsBlocked(newGX, newGY, PLAYER_HW)) {
    return { gx: newGX, gy: newGY };
  }
  // Slide along X axis only
  const slideX = !boxOverlapsBlocked(newGX, oldGY, PLAYER_HW);
  // Slide along Y axis only
  const slideY = !boxOverlapsBlocked(oldGX, newGY, PLAYER_HW);

  if (slideX && slideY) {
    // Both axes work individually — pick the one with larger displacement
    const dxAbs = Math.abs(newGX - oldGX);
    const dyAbs = Math.abs(newGY - oldGY);
    if (dxAbs >= dyAbs) return { gx: newGX, gy: oldGY };
    return { gx: oldGX, gy: newGY };
  }
  if (slideX) return { gx: newGX, gy: oldGY };
  if (slideY) return { gx: oldGX, gy: newGY };

  // Fully blocked — stay put
  return { gx: oldGX, gy: oldGY };
}

/**
 * Resolve bug movement with collision + axis sliding.
 */
export function resolveBugMove(
  oldGX: number, oldGY: number,
  newGX: number, newGY: number,
): { gx: number; gy: number } {
  if (!boxOverlapsBlocked(newGX, newGY, BUG_HW)) {
    return { gx: newGX, gy: newGY };
  }
  const slideX = !boxOverlapsBlocked(newGX, oldGY, BUG_HW);
  const slideY = !boxOverlapsBlocked(oldGX, newGY, BUG_HW);
  if (slideX) return { gx: newGX, gy: oldGY };
  if (slideY) return { gx: oldGX, gy: newGY };
  return { gx: oldGX, gy: oldGY };
}
