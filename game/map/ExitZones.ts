import * as Phaser from "phaser";
import { GRID_SIZE, gridToScreen } from "../constants";

// Matching gap definitions from BorderRenderer and PaloVerdeLane
const GAP_MIN = 8;
const GAP_MAX = 12;

// Trigger zone transition when player crosses this far outside the border
const EXIT_THRESHOLD_LOW  = -1.5;  // for north (gy) and west (gx)
const EXIT_THRESHOLD_HIGH = GRID_SIZE - 0.5; // for east (gx)

export class ExitZones {
  private scene: Phaser.Scene;
  private triggered = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    // North exit: center of gap at gx=10, gy=0 — sign 1 tile inside
    this.drawExitSign(10, 1.2, "↑");
    // West exit: gx=0, center gy=10 — sign 1 tile inside
    this.drawExitSign(1.2, 10, "←");
    // East exit: gx=19, center gy=10 — sign 1 tile inside
    this.drawExitSign(17.8, 10, "→");
  }

  // Returns true once per exit event (caller should restart scene)
  update(gx: number, gy: number): boolean {
    if (this.triggered) return false;

    const inHorizGap = gy >= GAP_MIN && gy <= GAP_MAX; // east/west exits
    const inVertGap  = gx >= GAP_MIN && gx <= GAP_MAX; // north exit

    const exitedNorth = inVertGap  && gy < EXIT_THRESHOLD_LOW;
    const exitedWest  = inHorizGap && gx < EXIT_THRESHOLD_LOW;
    const exitedEast  = inHorizGap && gx > EXIT_THRESHOLD_HIGH;

    if (exitedNorth || exitedWest || exitedEast) {
      this.triggered = true;
      return true;
    }
    return false;
  }

  private drawExitSign(gx: number, gy: number, arrow: string): void {
    const { x, y } = gridToScreen(gx, gy);

    // Sign post
    const g = this.scene.add.graphics();
    const depth = 100 + (Math.floor(gx) + Math.floor(gy)) * 50 + 180;
    g.setDepth(depth);
    g.setPosition(x, y);

    // Wooden post
    g.fillStyle(0x7A5C2E, 1);
    g.fillRect(-3, -4, 6, 26);

    // Sign board background
    g.fillStyle(0xF0C040, 1);
    g.fillRect(-20, -28, 40, 20);

    // Sign board border
    g.lineStyle(2, 0x8B6914, 1);
    g.strokeRect(-20, -28, 40, 20);

    // Directional arrow text
    const text = this.scene.add.text(x, y - 18, arrow, {
      fontSize: "16px",
      color: "#5A3A00",
      fontStyle: "bold",
      fontFamily: "system-ui, -apple-system, sans-serif",
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(depth + 1);
  }
}
