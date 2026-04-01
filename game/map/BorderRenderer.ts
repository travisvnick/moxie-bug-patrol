import * as Phaser from "phaser";
import { BG_COLOR, GRID_SIZE, TILE_WIDTH, TILE_HEIGHT, gridToScreen } from "../constants";

// Grid positions that are open exits (no wall drawn)
function isExitGap(gx: number, gy: number): boolean {
  if (gy === 0             && gx >= 8 && gx <= 12) return true; // north exit
  if (gx === 0             && gy >= 8 && gy <= 12) return true; // west exit
  if (gx === GRID_SIZE - 1 && gy >= 8 && gy <= 12) return true; // east exit
  return false;
}

function isBorderTile(gx: number, gy: number): boolean {
  return gx === 0 || gy === 0 || gx === GRID_SIZE - 1 || gy === GRID_SIZE - 1;
}

export class BorderRenderer {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.svg("mesa",           "/sprites/mesa.svg",
                   { width: 640, height: 240 });
    scene.load.svg("saguaro-faded",  "/sprites/saguaro-faded.svg");
  }

  create(): void {
    this.drawFarBackground();
    this.drawBorderWall();
    this.drawDistantScenery();
  }

  // ── Far background ─────────────────────────────────────────────────────────
  private drawFarBackground(): void {
    const g = this.scene.add.graphics();
    g.setDepth(0);

    // Solid ground color — matches tiles exactly, no gradient, no sky
    g.fillStyle(BG_COLOR, 1);
    g.fillRect(-8000, -2000, 16000, 12000);
  }

  // ── Rock border wall ────────────────────────────────────────────────────────
  private drawBorderWall(): void {
    const tw2   = TILE_WIDTH  / 2; // 32
    const th2   = TILE_HEIGHT / 2; // 16
    const wallH = 22;               // wall height in pixels

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        if (!isBorderTile(gx, gy)) continue;
        if (isExitGap(gx, gy))     continue;

        const { x, y } = gridToScreen(gx, gy);
        // Each wall tile gets its own graphics so depth sort is correct
        const tile = this.scene.add.graphics();
        tile.setDepth(100 + (gx + 1 + gy + 1) * 50 + gx + 1);

        // Ground tile — dark rocky
        tile.fillStyle(0x8B7355, 1);
        tile.fillPoints([
          { x,          y           },
          { x: x + tw2, y: y + th2  },
          { x,          y: y + TILE_HEIGHT },
          { x: x - tw2, y: y + th2  },
        ], true);

        // Right wall face (lighter)
        tile.fillStyle(0x9B8265, 1);
        tile.fillPoints([
          { x,          y: y + TILE_HEIGHT        },
          { x: x + tw2, y: y + th2                },
          { x: x + tw2, y: y + th2    - wallH     },
          { x,          y: y + TILE_HEIGHT - wallH },
        ], true);

        // Left wall face (darker)
        tile.fillStyle(0x7A6550, 1);
        tile.fillPoints([
          { x: x - tw2, y: y + th2                },
          { x,          y: y + TILE_HEIGHT        },
          { x,          y: y + TILE_HEIGHT - wallH },
          { x: x - tw2, y: y + th2    - wallH     },
        ], true);

        // Top face (lightest — lit from above)
        tile.fillStyle(0xB09070, 1);
        tile.fillPoints([
          { x: x,          y: y            - wallH },
          { x: x + tw2,    y: y + th2      - wallH },
          { x: x,          y: y + TILE_HEIGHT - wallH },
          { x: x - tw2,    y: y + th2      - wallH },
        ], true);

        // Rock texture dots
        tile.fillStyle(0x6B5540, 0.45);
        tile.fillCircle(x - 10, y + th2 - wallH / 2, 3);
        tile.fillCircle(x + 8,  y + TILE_HEIGHT - wallH * 0.55, 2.5);
        tile.fillStyle(0xC0A880, 0.3);
        tile.fillCircle(x + tw2 - 14, y + th2 - wallH * 0.75, 2);

        // Outline
        tile.lineStyle(1, 0x5A4535, 0.7);
        tile.strokePoints([
          { x: x,          y: y            - wallH },
          { x: x + tw2,    y: y + th2      - wallH },
          { x: x,          y: y + TILE_HEIGHT - wallH },
          { x: x - tw2,    y: y + th2      - wallH },
        ], true);
      }
    }
  }

  // ── Distant scenery beyond the border ──────────────────────────────────────
  private drawDistantScenery(): void {
    // Mesa silhouettes appear in the sky behind the top of the grid
    const mesas = [
      { x: -280, y: -170, flipX: false },
      { x:  280, y: -140, flipX: true  },
      { x:    0, y: -190, flipX: false },
    ];
    for (const m of mesas) {
      const img = this.scene.add.image(m.x, m.y, "mesa");
      img.setOrigin(0.5, 1);
      img.setDepth(5);
      if (m.flipX) img.setFlipX(true);
    }

    // Faded saguaros just outside the border wall
    const saguaros = [
      { x: -680, y: 260 }, { x: -720, y: 360 }, { x: -640, y: 440 },
      { x:  680, y: 260 }, { x:  720, y: 360 }, { x:  640, y: 440 },
      { x: -180, y: -80 }, { x:  120, y: -60 }, { x:  300, y: -100 },
    ];
    for (const s of saguaros) {
      const img = this.scene.add.image(s.x, s.y, "saguaro-faded");
      img.setOrigin(0.5, 1);
      img.setDepth(8);
    }
  }
}
