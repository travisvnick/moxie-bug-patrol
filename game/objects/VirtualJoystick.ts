import Phaser from 'phaser';

// World-space radii. With zoom=2 these appear 2× larger on screen.
const BASE_RADIUS = 60;
const THUMB_RADIUS = 28;
const DEAD_ZONE = 8;   // screen pixels

export class VirtualJoystick {
  private base: Phaser.GameObjects.Graphics;
  private thumb: Phaser.GameObjects.Graphics;
  /** World-space centre (= screenPos / zoom for scrollFactor=0 objects) */
  private cx: number;
  private cy: number;
  /** Camera zoom — used to convert between screen-px and world-px */
  private zoom: number;
  private active = false;
  private activePointerId = -1;

  dx = 0;
  dy = 0;

  constructor(private scene: Phaser.Scene, x: number, y: number, zoom = 1) {
    this.cx = x;
    this.cy = y;
    this.zoom = zoom;

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

  /** Screen-space centre of the joystick */
  private get screenCx() { return this.cx * this.zoom; }
  private get screenCy() { return this.cy * this.zoom; }

  private drawBase() {
    this.base.clear();
    this.base.fillStyle(0x000000, 0.25);
    this.base.fillCircle(this.cx, this.cy, BASE_RADIUS);
    this.base.lineStyle(3, 0xffffff, 0.55);
    this.base.strokeCircle(this.cx, this.cy, BASE_RADIUS);
  }

  private drawThumb(wx: number, wy: number) {
    this.thumb.clear();
    this.thumb.fillStyle(0xffffff, 0.75);
    this.thumb.fillCircle(wx, wy, THUMB_RADIUS);
    this.thumb.lineStyle(2, 0x2D6A4F, 0.9);
    this.thumb.strokeCircle(wx, wy, THUMB_RADIUS);
  }

  private onDown(ptr: Phaser.Input.Pointer) {
    if (this.active) return;
    // ptr.x is in canvas/screen pixels (0..canvasWidth); left half = joystick zone
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

  /**
   * ptr.x / ptr.y are screen-space pixels.
   * this.cx / this.cy are world-space pixels (scrollFactor=0 → screen = world × zoom).
   * We work in screen space throughout, then convert thumb position back to world space for drawing.
   */
  private processMove(px: number, py: number) {
    const rawDx = px - this.screenCx;
    const rawDy = py - this.screenCy;
    const dist = Math.hypot(rawDx, rawDy);

    // Max travel in screen pixels, then convert to world for clamping
    const maxScreenDist = (BASE_RADIUS - THUMB_RADIUS) * this.zoom;
    const clamped = Math.min(dist, maxScreenDist);
    const angle = Math.atan2(rawDy, rawDx);

    // Draw thumb at world position
    const tx = this.cx + (Math.cos(angle) * clamped) / this.zoom;
    const ty = this.cy + (Math.sin(angle) * clamped) / this.zoom;
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
