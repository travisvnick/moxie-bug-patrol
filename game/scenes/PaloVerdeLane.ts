import * as Phaser from "phaser";
import { BG_COLOR, gridToScreen, PLAYER_START_X, PLAYER_START_Y } from "../constants";
import { MapRenderer }    from "../map/MapRenderer";
import { BorderRenderer } from "../map/BorderRenderer";

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

    // Center camera on the player start position (grid center)
    const { x: worldX, y: worldY } = gridToScreen(PLAYER_START_X, PLAYER_START_Y);
    this.cameras.main.scrollX = worldX - this.scale.width  / 2;
    this.cameras.main.scrollY = worldY - this.scale.height / 2;
  }
}
