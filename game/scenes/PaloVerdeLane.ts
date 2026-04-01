import * as Phaser from "phaser";
import {
  BG_COLOR, GRID_SIZE, TILE_WIDTH, TILE_HEIGHT,
  gridToScreen, PLAYER_START_X, PLAYER_START_Y,
} from "../constants";
import { MapRenderer }    from "../map/MapRenderer";
import { BorderRenderer } from "../map/BorderRenderer";

// World-space extents of the 20×20 isometric grid
// Top (0,0)→(0,0)  Right (19,0)→(608,304)  Left (0,19)→(-608,304)  Bottom (19,19)→(0,608)
const HALF_W    = TILE_WIDTH  / 2;                                    //  32
const HALF_H    = TILE_HEIGHT / 2;                                    //  16
const WORLD_L   = gridToScreen(0, GRID_SIZE - 1).x - HALF_W;         // -640
const WORLD_R   = gridToScreen(GRID_SIZE - 1, 0).x + HALF_W;         //  640
const WORLD_T   = gridToScreen(0, 0).y               - HALF_H;        //  -16
const WORLD_B   = gridToScreen(GRID_SIZE - 1, GRID_SIZE - 1).y + HALF_H; //  624
const CAM_PAD   = 1000; // pixels of scrollable space beyond each grid edge

export default class PaloVerdeLane extends Phaser.Scene {
  constructor() {
    super({ key: "PaloVerdeLane" });
  }

  preload(): void {
    MapRenderer.preload(this);
    BorderRenderer.preload(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);

    // Background, border wall, and distant scenery
    new BorderRenderer(this).create();

    // Ground tiles and all environment objects
    new MapRenderer(this).create();

    // Camera bounds cover the full grid + padding so player-follow (Step 3)
    // can scroll to any tile edge without exposing bare canvas.
    this.cameras.main.setBounds(
      WORLD_L - CAM_PAD,
      WORLD_T - CAM_PAD,
      (WORLD_R - WORLD_L) + CAM_PAD * 2,
      (WORLD_B - WORLD_T) + CAM_PAD * 2,
    );

    // Start camera centred on the player start position
    const { x: worldX, y: worldY } = gridToScreen(PLAYER_START_X, PLAYER_START_Y);
    this.cameras.main.scrollX = worldX - this.scale.width  / 2;
    this.cameras.main.scrollY = worldY - this.scale.height / 2;
  }
}
