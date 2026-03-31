import * as Phaser from "phaser";
import PaloVerdeLane from "./scenes/PaloVerdeLane";
import { BG_COLOR } from "./constants";

export function createGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    backgroundColor: BG_COLOR,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: "100%",
      height: "100%",
    },
    scene: [PaloVerdeLane],
  };

  return new Phaser.Game(config);
}
