import Phaser from 'phaser';
import { gridToScreen, screenDirToGrid, GRID_SIZE, COL_MOXIE, COL_SAGE } from '../constants';

const PLAYER_SPEED = 4.5; // grid units per second
const MIN_GRID = 0.3;
const MAX_GRID = GRID_SIZE - 1.3;

export class Player {
  private gfx: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Graphics;

  gx: number;
  gy: number;

  constructor(private scene: Phaser.Scene, gx: number, gy: number) {
    this.gx = gx;
    this.gy = gy;
    this.shadow = scene.add.graphics();
    this.gfx = scene.add.graphics();
    this.redraw();
  }

  /**
   * Move using a screen-space direction vector (from keyboard or joystick).
   * dx/dy should be normalised to [-1, 1].
   */
  move(sdx: number, sdy: number, delta: number) {
    const { gx: dgx, gy: dgy } = screenDirToGrid(sdx, sdy);
    const speed = PLAYER_SPEED * (delta / 1000);
    this.gx = Phaser.Math.Clamp(this.gx + dgx * speed, MIN_GRID, MAX_GRID);
    this.gy = Phaser.Math.Clamp(this.gy + dgy * speed, MIN_GRID, MAX_GRID);
    this.redraw();
  }

  private redraw() {
    const { x, y } = gridToScreen(this.gx, this.gy);
    const depth = this.gx + this.gy;

    // Shadow
    this.shadow.clear();
    this.shadow.setDepth(depth - 0.01);
    this.shadow.fillStyle(0x000000, 0.18);
    this.shadow.fillEllipse(x, y, 26, 10);

    // Body
    this.gfx.clear();
    this.gfx.setDepth(depth + 0.5);

    // Shoes
    this.gfx.fillStyle(0x5B3C11);
    this.gfx.fillEllipse(x - 5, y + 2, 10, 6);
    this.gfx.fillEllipse(x + 5, y + 2, 10, 6);

    // Legs
    this.gfx.fillStyle(0x4A7C59);
    this.gfx.fillRect(x - 8, y - 14, 6, 16);
    this.gfx.fillRect(x + 2, y - 14, 6, 16);

    // Body / vest (sage green)
    this.gfx.fillStyle(COL_SAGE);
    this.gfx.fillRoundedRect(x - 10, y - 30, 20, 18, 4);

    // Net handle
    this.gfx.lineStyle(2, 0xC4A882);
    this.gfx.beginPath();
    this.gfx.moveTo(x + 9, y - 22);
    this.gfx.lineTo(x + 18, y - 38);
    this.gfx.strokePath();
    // Net hoop
    this.gfx.lineStyle(2, 0xD4B896);
    this.gfx.strokeCircle(x + 18, y - 38, 9);
    // Net mesh lines
    this.gfx.lineStyle(1, 0xD4B896, 0.5);
    this.gfx.lineBetween(x + 9, y - 38, x + 27, y - 38);
    this.gfx.lineBetween(x + 18, y - 29, x + 18, y - 47);

    // Head
    this.gfx.fillStyle(0xF5CBA7);
    this.gfx.fillCircle(x, y - 38, 9);

    // Hat brim (Moxie green)
    this.gfx.fillStyle(COL_MOXIE);
    this.gfx.fillRect(x - 13, y - 44, 26, 4);
    // Hat crown
    this.gfx.fillRect(x - 9, y - 56, 18, 14);

    // Eyes
    this.gfx.fillStyle(0x333333);
    this.gfx.fillCircle(x - 3, y - 39, 1.5);
    this.gfx.fillCircle(x + 3, y - 39, 1.5);

    // Smile
    this.gfx.lineStyle(1, 0x8B5E3C);
    this.gfx.beginPath();
    this.gfx.arc(x, y - 36, 4, 0, Math.PI, false);
    this.gfx.strokePath();
  }

  getScreenPos() {
    return gridToScreen(this.gx, this.gy);
  }

  destroy() {
    this.gfx.destroy();
    this.shadow.destroy();
  }
}
