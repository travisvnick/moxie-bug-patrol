import * as Phaser from "phaser";
import { GRID_SIZE, TILE_WIDTH, TILE_HEIGHT, gridToScreen } from "../constants";
import { registerBlocked, registerBlockedRect } from "../systems/CollisionSystem";

// Park tile region (green ground)
const PARK = { gxMin: 9, gxMax: 13, gyMin: 14, gyMax: 18 };

const HOUSES = [
  { key: "house",   gx: 2,  gy: 2  },
  { key: "house-b", gx: 2,  gy: 14 },
  { key: "house",   gx: 6,  gy: 7  },
  { key: "house-b", gx: 14, gy: 3  },
  { key: "house",   gx: 15, gy: 13 },
];

const HQ = { key: "moxie-hq", gx: 9, gy: 3 };

const TREES  = [
  { gx: 5,  gy: 3  }, { gx: 13, gy: 4  }, { gx: 3,  gy: 11 }, { gx: 16, gy: 10 },
  { gx: 9,  gy: 15 }, { gx: 10, gy: 15 }, { gx: 11, gy: 16 }, { gx: 8,  gy: 17 },
];

const CACTI = [
  { gx: 1,  gy: 6  }, { gx: 2,  gy: 7  }, { gx: 7,  gy: 1  }, { gx: 8,  gy: 2  },
  { gx: 17, gy: 7  }, { gx: 18, gy: 8  }, { gx: 16, gy: 17 }, { gx: 17, gy: 18 },
  { gx: 4,  gy: 16 }, { gx: 12, gy: 5  }, { gx: 5,  gy: 18 }, { gx: 18, gy: 4  },
];

const CACTI_SHORT = [
  { gx: 3,  gy: 4  }, { gx: 11, gy: 3  }, { gx: 15, gy: 8  }, { gx: 6,  gy: 12 },
];

const ROCKS = [
  { gx: 4,  gy: 13 }, { gx: 13, gy: 8  }, { gx: 7,  gy: 17 },
  { gx: 16, gy: 5  }, { gx: 3,  gy: 6  }, { gx: 17, gy: 13 },
];

const BUSHES = [
  { gx: 7,  gy: 5  }, { gx: 8,  gy: 6  }, { gx: 4,  gy: 10 },
  { gx: 14, gy: 11 }, { gx: 6,  gy: 15 }, { gx: 17, gy: 10 }, { gx: 2,  gy: 10 },
];

export class MapRenderer {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.svg("house",           "/sprites/house.svg");
    scene.load.svg("house-b",         "/sprites/house-b.svg");
    scene.load.svg("moxie-hq",        "/sprites/moxie-hq.svg");
    scene.load.svg("moxie-truck",     "/sprites/moxie-truck.svg");
    scene.load.svg("tree-palo-verde", "/sprites/tree-palo-verde.svg");
    scene.load.svg("cactus",          "/sprites/cactus.svg");
    scene.load.svg("cactus-short",    "/sprites/cactus-short.svg");
    scene.load.svg("rock-pile",       "/sprites/rock-pile.svg");
    scene.load.svg("bush",            "/sprites/bush.svg");
    scene.load.svg("ground-tile-1",   "/sprites/ground-tile-1.svg", { width: 64, height: 32 });
    scene.load.svg("ground-tile-2",   "/sprites/ground-tile-2.svg", { width: 64, height: 32 });
    scene.load.svg("ground-tile-3",   "/sprites/ground-tile-3.svg", { width: 64, height: 32 });
  }

  create(): void {
    this.drawGroundTiles();
    this.placeAllObjects();
  }

  private drawGroundTiles(): void {
    const tw2 = TILE_WIDTH  / 2; // 32
    const th2 = TILE_HEIGHT / 2; // 16

    // Park region uses Graphics (green, no SVG variant needed)
    const park = this.scene.add.graphics();
    park.setDepth(10);

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const { x, y } = gridToScreen(gx, gy);
        const isPark = gx >= PARK.gxMin && gx <= PARK.gxMax
                    && gy >= PARK.gyMin && gy <= PARK.gyMax;

        if (isPark) {
          park.fillStyle(0x88B860, 1);
          park.fillPoints([
            { x,          y           },
            { x: x + tw2, y: y + th2  },
            { x,          y: y + TILE_HEIGHT },
            { x: x - tw2, y: y + th2  },
          ], true);
          park.lineStyle(0.5, 0x70A050, 0.3);
          park.strokePoints([
            { x,          y           },
            { x: x + tw2, y: y + th2  },
            { x,          y: y + TILE_HEIGHT },
            { x: x - tw2, y: y + th2  },
          ], true);
        } else {
          // Sandy tiles use SVG sprites for visual variety
          const v = (gx * 7 + gy * 13) % 100;
          const key = v < 50 ? "ground-tile-1" : v < 80 ? "ground-tile-2" : "ground-tile-3";
          // Origin (0.5, 0) places the SVG's top-center at the tile's top vertex
          this.scene.add.image(x, y, key).setOrigin(0.5, 0).setDepth(10);
        }
      }
    }
  }

  private placeAllObjects(): void {
    // 2x2 footprint buildings — blocked
    for (const h of HOUSES) {
      this.placeSprite(h.key, h.gx, h.gy, 2);
      registerBlockedRect(h.gx, h.gy, 2, 2);
    }
    this.placeSprite(HQ.key, HQ.gx, HQ.gy, 2);
    registerBlockedRect(HQ.gx, HQ.gy, 2, 2);
    // Moxie truck parked adjacent to HQ (decorative, not blocked)
    this.placeSprite("moxie-truck", 11, 4, 1);

    // 1x1 footprint objects
    // Trees: trunk tile blocked (canopy is walk-under)
    for (const t of TREES) {
      this.placeSprite("tree-palo-verde", t.gx, t.gy, 1);
      registerBlocked(t.gx, t.gy);
    }
    // Cacti: blocked
    for (const c of CACTI) {
      this.placeSprite("cactus", c.gx, c.gy, 1);
      registerBlocked(c.gx, c.gy);
    }
    // Short cacti: blocked
    for (const c of CACTI_SHORT) {
      this.placeSprite("cactus-short", c.gx, c.gy, 1);
      registerBlocked(c.gx, c.gy);
    }
    // Rocks: blocked
    for (const r of ROCKS) {
      this.placeSprite("rock-pile", r.gx, r.gy, 1);
      registerBlocked(r.gx, r.gy);
    }
    // Bushes: walkable (not blocked)
    for (const b of BUSHES) this.placeSprite("bush", b.gx, b.gy, 1);
  }

  // Place a sprite at the front-bottom vertex of its tile footprint.
  // footprint: 1 = 1x1 tile, 2 = 2x2 tiles.
  // Anchor is (0.5, 1) — center-bottom of sprite aligns to front vertex.
  private placeSprite(key: string, gx: number, gy: number, footprint: number): void {
    const { x, y } = gridToScreen(gx + footprint, gy + footprint);
    const img = this.scene.add.image(x, y, key);
    img.setOrigin(0.5, 1.0);
    // Depth: higher gx+gy = closer to viewer = renders on top
    img.setDepth(100 + (gx + footprint + gy + footprint) * 50 + gx + footprint);
  }
}
