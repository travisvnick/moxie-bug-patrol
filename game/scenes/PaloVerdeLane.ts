import * as Phaser from "phaser";
import { BG_COLOR } from "../constants";

export default class PaloVerdeLane extends Phaser.Scene {
  constructor() {
    super({ key: "PaloVerdeLane" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
  }
}
