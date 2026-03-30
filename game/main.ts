import Phaser from 'phaser';
import { PaloVerdeLane } from './scenes/PaloVerdeLane';

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#87CEEB',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PaloVerdeLane],
    input: {
      touch: true,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  });
}
