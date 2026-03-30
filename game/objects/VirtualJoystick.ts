import Phaser from 'phaser';

const BASE_RADIUS = 60;
const THUMB_RADIUS = 26;
const DEAD_ZONE = 6;

export class VirtualJoystick {
  private base: Phaser.GameObjects.Graphics;
  private thumb: Phaser.GameObjects.Graphics;
  private cx: number;
  private cy: number;
  private active = false;
  private activePointerId = -1;

  dx = 0;
  dy = 0;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.cx = x;
    this.cy = y;

    this.base = scene.add.graphics();
    this.thumb = scene.add.graphics();
    this.base.setScrollFactor(0).setDepth(100);
    this.thumb.setScrollFactor(0).setDepth(101);

    this.drawBase();
    this.drawThumb(x, y);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  private drawBase() {
    this.base.clear();
    this.base.fillStyle(0x000000, 0.18);
    this.base.fillCircle(this.cx, this.cy, BASE_RADIUS);
    this.base.lineStyle(2, 0xffffff, 0.35);
    this.base.strokeCircle(this.cx, this.cy, BASE_RADIUS);
  }

  private drawThumb(x: number, y: number) {
    this.thumb.clear();
    this.thumb.fillStyle(0xffffff, 0.65);
    this.thumb.fillCircle(x, y, THUMB_RADIUS);
    this.thumb.lineStyle(2, 0x2D6A4F, 0.8);
    this.thumb.strokeCircle(x, y, THUMB_RADIUS);
  }

  private onDown(ptr: Phaser.Input.Pointer) {
    if (this.active) return;
    // Only capture taps on the left half of the screen
    if (ptr.x < this.scene.cameras.main.width / 2) {
      this.active = true;
      this.activePointerId = ptr.id;
      this.processMove(ptr.x, ptr.y);
    }
  }

  private onMove(ptr: Phaser.Input.Pointer) {
    if (!this.active || ptr.id !== this.activePointerId) return;
    this.processMove(ptr.x, ptr.y);
  }

  private onUp(ptr: Phaser.Input.Pointer) {
    if (ptr.id !== this.activePointerId) return;
    this.active = false;
    this.activePointerId = -1;
    this.dx = 0;
    this.dy = 0;
    this.drawThumb(this.cx, this.cy);
  }

  private processMove(px: number, py: number) {
    const rawDx = px - this.cx;
    const rawDy = py - this.cy;
    const dist = Math.hypot(rawDx, rawDy);
    const maxDist = BASE_RADIUS - THUMB_RADIUS;
    const clamped = Math.min(dist, maxDist);
    const angle = Math.atan2(rawDy, rawDx);

    const tx = this.cx + Math.cos(angle) * clamped;
    const ty = this.cy + Math.sin(angle) * clamped;
    this.drawThumb(tx, ty);

    if (dist > DEAD_ZONE) {
      this.dx = Math.cos(angle);
      this.dy = Math.sin(angle);
    } else {
      this.dx = 0;
      this.dy = 0;
    }
  }

  destroy() {
    this.base.destroy();
    this.thumb.destroy();
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
  }
}
