import Phaser from 'phaser';
import { gridToScreen, screenDirToGrid, GRID_SIZE, COL_MOXIE } from '../constants';

const PLAYER_SPEED = 2.7; // grid units per second
const MIN_GRID = -0.5;
const MAX_GRID = GRID_SIZE + 0.5; // scene applies per-screen soft walls

export class Player {
  private gfx: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Graphics;

  gx: number;
  gy: number;

  private moveTargetGx: number | null = null;
  private moveTargetGy: number | null = null;

  // Walking animation state
  private walkBob = 0;
  private leanDir = 0; // screen-space horizontal lean, -1 to 1
  private isWalking = false;

  constructor(private scene: Phaser.Scene, gx: number, gy: number) {
    this.gx = gx;
    this.gy = gy;
    this.shadow = scene.add.graphics();
    this.gfx = scene.add.graphics();
    this.redraw();
  }

  /**
   * Move using a screen-space direction vector (from keyboard).
   * dx/dy should be normalised to [-1, 1].
   */
  move(sdx: number, sdy: number, delta: number) {
    const { gx: dgx, gy: dgy } = screenDirToGrid(sdx, sdy);
    const speed = PLAYER_SPEED * (delta / 1000);
    this.gx = Phaser.Math.Clamp(this.gx + dgx * speed, MIN_GRID, MAX_GRID);
    this.gy = Phaser.Math.Clamp(this.gy + dgy * speed, MIN_GRID, MAX_GRID);
    this.leanDir = sdx;
    this.walkBob += delta * 0.008;
    this.isWalking = true;
    this.redraw();
  }

  /** Set a tap/hold destination in grid coords. */
  moveTo(gx: number, gy: number) {
    this.moveTargetGx = Phaser.Math.Clamp(gx, MIN_GRID, MAX_GRID);
    this.moveTargetGy = Phaser.Math.Clamp(gy, MIN_GRID, MAX_GRID);
  }

  /** Cancel movement (e.g. when keyboard takes over). */
  stopMove() {
    this.moveTargetGx = null;
    this.moveTargetGy = null;
  }

  /** Signal player is idle this frame — stops walking animation. */
  setIdle() {
    if (this.isWalking) {
      this.isWalking = false;
      this.leanDir = 0;
      this.redraw();
    }
  }

  /** Returns true if still walking toward a tap/hold target. Call each frame. */
  updateMove(delta: number): boolean {
    if (this.moveTargetGx === null || this.moveTargetGy === null) return false;
    const dx = this.moveTargetGx - this.gx;
    const dy = this.moveTargetGy - this.gy;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.08) {
      this.moveTargetGx = null;
      this.moveTargetGy = null;
      return false;
    }
    const speed = PLAYER_SPEED * (delta / 1000);
    const step = Math.min(speed, dist);
    this.gx += (dx / dist) * step;
    this.gy += (dy / dist) * step;
    this.gx = Phaser.Math.Clamp(this.gx, MIN_GRID, MAX_GRID);
    this.gy = Phaser.Math.Clamp(this.gy, MIN_GRID, MAX_GRID);
    // Lean based on isometric screen-x direction: proportional to (dx - dy)
    this.leanDir = Phaser.Math.Clamp((dx - dy) / dist, -1, 1);
    this.walkBob += delta * 0.008;
    this.isWalking = true;
    this.redraw();
    return true;
  }

  private redraw() {
    const { x, y } = gridToScreen(this.gx, this.gy);
    const depth = this.gx + this.gy;

    // Vertical bob while walking
    const bob = this.isWalking ? Math.sin(this.walkBob * 8) * 2.5 : 0;
    // Horizontal lean for upper body
    const lean = this.leanDir * 3;

    // Shadow
    this.shadow.clear();
    this.shadow.setDepth(depth - 0.01);
    this.shadow.fillStyle(0x000000, 0.18);
    this.shadow.fillEllipse(x, y, 26, 10);

    this.gfx.clear();
    this.gfx.setDepth(depth + 0.5);

    // Legs (alternate stepping when walking)
    const legBob1 = this.isWalking ? Math.sin(this.walkBob * 8) * 3 : 0;
    const legBob2 = -legBob1;
    this.gfx.fillStyle(0x1A4A2A);
    this.gfx.fillRect(x - 8, y - 14 + legBob1, 6, 16);
    this.gfx.fillRect(x + 2, y - 14 + legBob2, 6, 16);

    // Shoes
    this.gfx.fillStyle(0x5B3C11);
    this.gfx.fillEllipse(x - 5, y + 2, 10, 6);
    this.gfx.fillEllipse(x + 5, y + 2, 10, 6);

    // Body / uniform (Moxie green)
    this.gfx.fillStyle(COL_MOXIE);
    this.gfx.fillRoundedRect(x - 10 + lean * 0.4, y - 30 + bob, 20, 18, 4);

    // Net handle
    this.gfx.lineStyle(2, 0xC4A882);
    this.gfx.beginPath();
    this.gfx.moveTo(x + 9 + lean, y - 22 + bob);
    this.gfx.lineTo(x + 18 + lean, y - 38 + bob);
    this.gfx.strokePath();
    // Net hoop
    this.gfx.lineStyle(2, 0xD4B896);
    this.gfx.strokeCircle(x + 18 + lean, y - 38 + bob, 9);
    // Net mesh lines
    this.gfx.lineStyle(1, 0xD4B896, 0.5);
    this.gfx.lineBetween(x + 9 + lean, y - 38 + bob, x + 27 + lean, y - 38 + bob);
    this.gfx.lineBetween(x + 18 + lean, y - 29 + bob, x + 18 + lean, y - 47 + bob);

    // Head
    this.gfx.fillStyle(0xF5CBA7);
    this.gfx.fillCircle(x + lean, y - 38 + bob, 9);

    // Hat brim (Moxie green)
    this.gfx.fillStyle(COL_MOXIE);
    this.gfx.fillRect(x - 13 + lean, y - 44 + bob, 26, 4);
    // Hat crown (leaned slightly more)
    this.gfx.fillRect(x - 9 + lean + lean * 0.5, y - 56 + bob, 18, 14);

    // Eyes
    this.gfx.fillStyle(0x333333);
    this.gfx.fillCircle(x - 3 + lean, y - 39 + bob, 1.5);
    this.gfx.fillCircle(x + 3 + lean, y - 39 + bob, 1.5);

    // Smile
    this.gfx.lineStyle(1, 0x8B5E3C);
    this.gfx.beginPath();
    this.gfx.arc(x + lean, y - 36 + bob, 4, 0, Math.PI, false);
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
