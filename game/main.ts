import Phaser from 'phaser';
import { PaloVerdeLane } from './scenes/PaloVerdeLane';

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#87CEEB',
    scale: {
      mode: Phaser.Scale.RESIZE,
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
