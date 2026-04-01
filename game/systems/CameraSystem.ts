import * as Phaser from "phaser";
import { gridToScreen } from "../constants";

// Hard-lock the camera to the player every frame.
// Never uses Phaser's startFollow() — caused drift in v1.
export class CameraSystem {
  private cam: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene) {
    this.cam = scene.cameras.main;
  }

  // Call every frame with the player's current grid position.
  update(playerGX: number, playerGY: number): void {
    // +1 because placeSprite uses gridToScreen(gx+1, gy+1) for 1x1 footprint objects
    const { x, y } = gridToScreen(playerGX + 1, playerGY + 1);
    this.cam.scrollX = x - this.cam.width  / 2;
    this.cam.scrollY = y - this.cam.height / 2;
  }
}
