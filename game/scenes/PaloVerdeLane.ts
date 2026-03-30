import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Bug } from '../objects/Bug';
import {
  gridToScreen, screenToGrid,
  TILE_HW, TILE_HH,
  GRID_SIZE,
  CANVAS_W, CANVAS_H,
  COL_SAND, COL_SAND_DARK,
  COL_TERRACOTTA, COL_SAGE, COL_MOXIE,
  COL_STUCCO, COL_CACTUS,
} from '../constants';
import { emitBugCaught } from '../eventBus';

const CATCH_RADIUS = 1.6;      // grid units
const RING_MIN = 8;
const RING_MAX = 44;
const RING_SPEED = 60;         // px/sec
const CATCH_WINDOW_MAX = 22;   // px — ring within this = green zone
const BUG_TAP_RADIUS = 24;    // world pixels — how close a tap must be to a bug

// Per-tile sand color variants for subtle ground variation
const SAND_LIGHT = [0xE8C99A, 0xEBCFA0, 0xE4C496, 0xEDD6A8, 0xE6CB97];
const SAND_DARK  = [0xD4A76A, 0xD8AB70, 0xCFA265, 0xD6A96C, 0xD0A468];

type KeySet = Phaser.Types.Input.Keyboard.CursorKeys & {
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
};

export class PaloVerdeLane extends Phaser.Scene {
  private player!: Player;
  private bugs: Bug[] = [];
  private keys!: KeySet;

  // Mobile scaling
  private zoom = 1;

  // Catch mini-game
  private catchRing!: Phaser.GameObjects.Graphics;
  private catchTarget: Bug | null = null;
  private ringRadius = RING_MIN;
  private ringDir = 1;

  // HUD
  private promptText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private caughtCount = 0;

  // Hold-to-move state
  private pointerHeld = false;
  private heldWorldX = 0;
  private heldWorldY = 0;

  constructor() {
    super({ key: 'PaloVerdeLane' });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create() {
    // Sky: warm Arizona sunset gradient (deep blue → orange)
    const sky = this.add.graphics().setDepth(-2);
    sky.fillGradientStyle(0x0D1B4A, 0x0D1B4A, 0xE8604A, 0xE8604A);
    sky.fillRect(-CANVAS_W * 2, -CANVAS_H * 2, CANVAS_W * 6, CANVAS_H * 0.45 + CANVAS_H * 3);
    // Warm golden horizon
    sky.fillStyle(0xFFB347);
    sky.fillRect(-CANVAS_W * 2, CANVAS_H * 0.45, CANVAS_W * 6, CANVAS_H * 4);

    this.drawGround();
    this.drawEnvironment();

    this.player = new Player(this, 7, 7);

    const bugSpots: [number, number, number][] = [
      [3, 4, 0],
      [11, 5, 1],
      [4, 11, 2],
      [10, 11, 3],
      [7, 2, 4],
    ];
    for (const [gx, gy, type] of bugSpots) {
      this.bugs.push(new Bug(this, gx, gy, type));
    }

    // Keyboard input
    if (this.input.keyboard) {
      this.keys = Object.assign(this.input.keyboard.createCursorKeys(), {
        w: this.input.keyboard.addKey('W'),
        a: this.input.keyboard.addKey('A'),
        s: this.input.keyboard.addKey('S'),
        d: this.input.keyboard.addKey('D'),
        space: this.input.keyboard.addKey('SPACE'),
      });
    }

    // Mobile zoom: wider view on small screens
    if (this.scale.width < 800) {
      this.cameras.main.setZoom(1.3);
    }

    this.zoom = this.cameras.main.zoom;
    const sw = this.scale.width / this.zoom;
    const sh = this.scale.height / this.zoom;

    // Catch ring
    this.catchRing = this.add.graphics().setDepth(200);

    // Prompt text (bottom-centre, screen-fixed)
    this.promptText = this.add.text(sw / 2, sh - 36 / this.zoom, '', {
      fontSize: `${Math.round(18 / this.zoom)}px`,
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 12, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setAlpha(0);

    // Score (top-left, screen-fixed)
    this.scoreText = this.add.text(16 / this.zoom, 14 / this.zoom, 'Bugs caught: 0', {
      fontSize: `${Math.round(18 / this.zoom)}px`,
      fontStyle: 'bold',
      color: '#2D6A4F',
      backgroundColor: '#ffffffcc',
      padding: { x: 10, y: 5 },
    }).setScrollFactor(0).setDepth(202);

    // Hint — fades out after 3s
    const hint = this.add.text(sw / 2, sh * 0.72, 'Hold to move, tap to catch!', {
      fontSize: `${Math.round(22 / this.zoom)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 16, y: 9 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(210);

    this.tweens.add({
      targets: hint,
      alpha: 0,
      delay: 2800,
      duration: 700,
      onComplete: () => hint.destroy(),
    });

    // Pointer input: hold-to-move
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.handlePointerDown(ptr);
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.pointerHeld) {
        this.heldWorldX = ptr.worldX;
        this.heldWorldY = ptr.worldY;
      }
    });
    this.input.on('pointerup', () => {
      this.pointerHeld = false;
      this.player.stopMove();
    });

    // Center camera on player start
    const startPos = gridToScreen(7, 7);
    this.cameras.main.centerOn(startPos.x, startPos.y);
  }

  update(_time: number, delta: number) {
    // Keyboard movement (returns true if keys were held)
    const keyboardMoved = this.handleKeyboard(delta);

    // Hold-to-move: keep updating target while pointer is held
    if (this.pointerHeld && !this.catchTarget && !keyboardMoved) {
      const { gx, gy } = screenToGrid(this.heldWorldX, this.heldWorldY);
      this.player.moveTo(gx, gy);
    }

    // Execute tap/hold movement
    const tapMoved = this.player.updateMove(delta);

    // Signal idle when no movement input
    if (!keyboardMoved && !tapMoved) {
      this.player.setIdle();
    }

    // Bug AI
    for (const bug of this.bugs) {
      if (!bug.caught) bug.update(delta, this.player.gx, this.player.gy);
    }

    // Camera hard-locked to player — player always dead center
    const { x: px, y: py } = this.player.getScreenPos();
    const cam = this.cameras.main;
    cam.scrollX = px - cam.width / cam.zoom / 2;
    cam.scrollY = py - cam.height / cam.zoom / 2;

    // Catch mini-game
    this.updateCatchGame(delta);

    // SPACE key catch attempt
    if (this.keys?.space && Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      this.attemptCatch();
    }
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private handleKeyboard(delta: number): boolean {
    if (!this.keys) return false;
    let sdx = 0;
    let sdy = 0;

    if (this.keys.left.isDown || this.keys.a.isDown)  sdx -= 1;
    if (this.keys.right.isDown || this.keys.d.isDown) sdx += 1;
    if (this.keys.up.isDown || this.keys.w.isDown)    sdy -= 1;
    if (this.keys.down.isDown || this.keys.s.isDown)  sdy += 1;

    if (sdx !== 0 || sdy !== 0) {
      const len = Math.hypot(sdx, sdy);
      this.player.move(sdx / len, sdy / len, delta);
      this.player.stopMove(); // keyboard overrides tap/hold-to-move
      return true;
    }
    return false;
  }

  private handlePointerDown(ptr: Phaser.Input.Pointer) {
    // If catch game is active, any tap times the catch
    if (this.catchTarget) {
      this.attemptCatch();
      return;
    }

    // Tap near a bug that's within catch range → attempt catch
    for (const bug of this.bugs) {
      if (bug.caught) continue;
      const distToPlayer = Math.hypot(bug.gx - this.player.gx, bug.gy - this.player.gy);
      if (distToPlayer < CATCH_RADIUS) {
        const { x: bx, y: by } = bug.getScreenPos();
        if (Math.hypot(ptr.worldX - bx, ptr.worldY - by) < BUG_TAP_RADIUS) {
          this.attemptCatch();
          return;
        }
      }
    }

    // Otherwise: start hold-to-move toward tapped position
    const { gx, gy } = screenToGrid(ptr.worldX, ptr.worldY);
    this.player.moveTo(gx, gy);
    this.pointerHeld = true;
    this.heldWorldX = ptr.worldX;
    this.heldWorldY = ptr.worldY;
  }

  // ─── Catch mini-game ──────────────────────────────────────────────────────

  private updateCatchGame(delta: number) {
    let nearest: Bug | null = null;
    let nearestDist = Infinity;

    for (const bug of this.bugs) {
      if (bug.caught) continue;
      const dx = bug.gx - this.player.gx;
      const dy = bug.gy - this.player.gy;
      const d = Math.hypot(dx, dy);
      if (d < CATCH_RADIUS && d < nearestDist) {
        nearest = bug;
        nearestDist = d;
      }
    }

    this.catchTarget = nearest;

    if (nearest) {
      // Animate ring
      this.ringRadius += this.ringDir * RING_SPEED * (delta / 1000);
      if (this.ringRadius >= RING_MAX) { this.ringRadius = RING_MAX; this.ringDir = -1; }
      if (this.ringRadius <= RING_MIN) { this.ringRadius = RING_MIN; this.ringDir = 1; }

      const inWindow = this.ringRadius <= CATCH_WINDOW_MAX;
      const { x, y } = nearest.getScreenPos();
      const oy = y - 10;

      this.catchRing.clear();

      // Sweet spot fill — brighter when ring is inside
      this.catchRing.fillStyle(0x00FF88, inWindow ? 0.22 : 0.08);
      this.catchRing.fillCircle(x, oy, CATCH_WINDOW_MAX);

      // Sweet spot ring outline
      this.catchRing.lineStyle(2, 0x00FF88, 0.85);
      this.catchRing.strokeCircle(x, oy, CATCH_WINDOW_MAX);

      // Main animated ring — thick and bright
      this.catchRing.lineStyle(5, inWindow ? 0x00FF88 : 0xFFAA00, 0.95);
      this.catchRing.strokeCircle(x, oy, this.ringRadius);

      // Soft outer glow
      this.catchRing.lineStyle(2, inWindow ? 0x88FFBB : 0xFFCC55, 0.35);
      this.catchRing.strokeCircle(x, oy, this.ringRadius + 4);

      this.promptText.setText('Tap to catch!').setAlpha(1);
    } else {
      this.catchRing.clear();
      this.promptText.setAlpha(0);
    }
  }

  private attemptCatch() {
    if (!this.catchTarget) return;
    if (this.ringRadius <= CATCH_WINDOW_MAX) {
      this.catchBug(this.catchTarget);
    } else {
      this.flashMiss();
    }
  }

  private catchBug(bug: Bug) {
    bug.caught = true;
    this.caughtCount++;
    this.scoreText.setText(`Bugs caught: ${this.caughtCount}`);

    const { x, y } = bug.getScreenPos();

    // Bright flash
    const flash = this.add.graphics().setDepth(300);
    flash.fillStyle(0xFFFFFF, 0.85);
    flash.fillCircle(x, y - 10, 28);
    this.tweens.add({
      targets: flash, alpha: 0, scaleX: 2.5, scaleY: 2.5,
      duration: 400, ease: 'Power2', onComplete: () => flash.destroy(),
    });

    // Sparkle burst (8 colored rays)
    const sparkle = this.add.graphics().setDepth(302);
    const rayColors = [0xFFD700, 0xFF69B4, 0x00FF88, 0x87CEEB, 0xFFD700, 0xFF69B4, 0x00FF88, 0x87CEEB];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      sparkle.lineStyle(2.5, rayColors[i], 1.0);
      sparkle.lineBetween(
        x + Math.cos(angle) * 8,  y - 10 + Math.sin(angle) * 8,
        x + Math.cos(angle) * 24, y - 10 + Math.sin(angle) * 24,
      );
    }
    this.tweens.add({
      targets: sparkle, alpha: 0, scaleX: 2.0, scaleY: 2.0,
      duration: 550, ease: 'Power2', onComplete: () => sparkle.destroy(),
    });

    // "Caught!" label with bug name
    const label = this.add.text(x, y - 40, `Caught!\n${bug.typeData.name}`, {
      fontSize: '18px', fontStyle: 'bold',
      color: '#FFD700',
      stroke: '#1A3A2A',
      strokeThickness: 3,
      align: 'center',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(301);
    this.tweens.add({
      targets: label, y: y - 110, alpha: 0,
      duration: 1600, ease: 'Power2',
      onComplete: () => label.destroy(),
    });

    bug.destroy();

    emitBugCaught({
      id: bug.id,
      name: bug.typeData.name,
      color: bug.typeData.color,
      description: bug.typeData.description,
      caughtAt: Date.now(),
    });

    this.ringRadius = RING_MIN;
    this.ringDir = 1;
    this.catchTarget = null;
  }

  private flashMiss() {
    // Boost the bug — it runs away faster after a miss
    if (this.catchTarget) {
      this.catchTarget.boostFlee();
    }

    const { x, y } = this.player.getScreenPos();
    const miss = this.add.text(x, y - 55, 'MISS!', {
      fontSize: '22px', fontStyle: 'bold',
      color: '#FF4444', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(301);
    this.tweens.add({
      targets: miss, y: y - 95, alpha: 0,
      duration: 700,
      onComplete: () => miss.destroy(),
    });
  }

  // ─── Environment drawing helpers ──────────────────────────────────────────

  private drawGround() {
    const g = this.add.graphics().setDepth(-1);

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const { x, y } = gridToScreen(gx, gy);
        const alt = (gx + gy) % 2 === 0;

        // Subtle per-tile color variation using position hash
        const hash = (gx * 7 + gy * 13 + gx * gy * 3) % 5;
        const tileColor = alt ? SAND_LIGHT[hash] : SAND_DARK[hash];

        g.fillStyle(tileColor);
        g.beginPath();
        g.moveTo(x,            y - TILE_HH);
        g.lineTo(x + TILE_HW, y);
        g.lineTo(x,            y + TILE_HH);
        g.lineTo(x - TILE_HW, y);
        g.closePath();
        g.fillPath();

        // Subtle grid line
        g.lineStyle(1, 0xC4A876, 0.20);
        g.beginPath();
        g.moveTo(x,            y - TILE_HH);
        g.lineTo(x + TILE_HW, y);
        g.lineTo(x,            y + TILE_HH);
        g.lineTo(x - TILE_HW, y);
        g.closePath();
        g.strokePath();
      }
    }
  }

  private drawEnvironment() {
    // Houses
    this.drawHouse(0, 0);
    this.drawHouse(11, 1);
    this.drawHouse(12, 10);

    // Palo verde trees
    this.drawPaloVerde(3, 2);
    this.drawPaloVerde(8, 2);
    this.drawPaloVerde(10, 7);
    this.drawPaloVerde(2, 10);
    this.drawPaloVerde(13, 5);

    // Saguaros
    this.drawSaguaro(1, 7);
    this.drawSaguaro(5, 13);
    this.drawSaguaro(12, 3);
    this.drawSaguaro(9, 12);
  }

  private drawHouse(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 3);
    const { x, y } = gridToScreen(gx, gy);
    const hw = TILE_HW;
    const wallH = 55;

    // Left wall face
    g.fillStyle(0xD8C8A8);
    g.beginPath();
    g.moveTo(x - hw, y);
    g.lineTo(x,       y + TILE_HH);
    g.lineTo(x,       y + TILE_HH - wallH);
    g.lineTo(x - hw, y - wallH);
    g.closePath();
    g.fillPath();

    // Front wall face
    g.fillStyle(COL_STUCCO);
    g.beginPath();
    g.moveTo(x,       y + TILE_HH);
    g.lineTo(x + hw,  y);
    g.lineTo(x + hw,  y - wallH);
    g.lineTo(x,       y + TILE_HH - wallH);
    g.closePath();
    g.fillPath();

    // Roof (terracotta)
    g.fillStyle(COL_TERRACOTTA);
    const roofH = 28;
    g.beginPath();
    g.moveTo(x - hw, y - wallH);
    g.lineTo(x,       y + TILE_HH - wallH);
    g.lineTo(x + hw,  y - wallH);
    g.lineTo(x,       y - wallH - roofH);
    g.closePath();
    g.fillPath();

    // Door
    g.fillStyle(0x8B5A2B);
    g.fillRect(x - 8, y + TILE_HH - wallH, 16, 26);

    // Window front
    g.fillStyle(0x87CEEB);
    g.fillRect(x + 10, y - wallH + 8, 16, 16);
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(x + 18, y - wallH + 8, 2, 16);
    g.fillRect(x + 10, y - wallH + 16, 16, 2);

    // Window left
    g.fillStyle(0x87CEEB);
    g.beginPath();
    g.moveTo(x - hw + 5, y - wallH + 8);
    g.lineTo(x - hw + 20, y - wallH + 8 + TILE_HH * 0.3);
    g.lineTo(x - hw + 20, y - wallH + 24 + TILE_HH * 0.3);
    g.lineTo(x - hw + 5, y - wallH + 24);
    g.closePath();
    g.fillPath();
  }

  private drawPaloVerde(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);

    // Trunk
    g.fillStyle(0x9CB850);
    g.fillRoundedRect(x - 5, y - 50, 10, 50, 5);

    // Branches
    g.lineStyle(4, 0x8FAF7E);
    g.lineBetween(x - 2, y - 35, x - 22, y - 58);
    g.lineBetween(x + 2, y - 35, x + 22, y - 58);
    g.lineBetween(x,     y - 42, x,      y - 66);
    g.lineStyle(3, 0x8FAF7E);
    g.lineBetween(x - 20, y - 55, x - 30, y - 68);
    g.lineBetween(x + 20, y - 55, x + 30, y - 68);

    // Foliage puffs
    const puffs = [
      { px: x,      py: y - 70, r: 14 },
      { px: x - 24, py: y - 62, r: 12 },
      { px: x + 24, py: y - 62, r: 12 },
      { px: x - 12, py: y - 78, r: 10 },
      { px: x + 12, py: y - 78, r: 10 },
      { px: x - 32, py: y - 70, r: 9  },
      { px: x + 32, py: y - 70, r: 9  },
    ];
    for (const p of puffs) {
      g.fillStyle(COL_SAGE, 0.85);
      g.fillCircle(p.px, p.py, p.r);
      g.fillStyle(0x6B9A60, 0.55);
      g.fillCircle(p.px + 3, p.py + 3, p.r * 0.65);
    }

    // Yellow flowers
    for (const p of puffs.slice(0, 4)) {
      g.fillStyle(0xFFD700);
      g.fillCircle(p.px + Phaser.Math.Between(-6, 6), p.py + Phaser.Math.Between(-4, 4), 2.5);
    }
  }

  private drawSaguaro(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);

    // Ground shadow
    g.fillStyle(0x000000, 0.14);
    g.fillEllipse(x + 8, y + 2, 28, 10);

    const drawCactusSegment = (cx: number, cy: number, w: number, h: number) => {
      g.fillStyle(COL_CACTUS);
      g.fillRoundedRect(cx - w / 2, cy - h, w, h, w / 2);
      // Ribs
      g.lineStyle(1, 0x3A6040, 0.4);
      for (let i = 1; i < 4; i++) {
        const ry = cy - h + (h / 4) * i;
        g.lineBetween(cx - w / 2 + 1, ry, cx + w / 2 - 1, ry);
      }
      // Spines
      g.fillStyle(0xE8C99A);
      for (let i = 0; i < 3; i++) {
        g.fillCircle(cx - w / 2 + 2, cy - h + (h / 3) * (i + 0.5), 1.5);
        g.fillCircle(cx + w / 2 - 2, cy - h + (h / 3) * (i + 0.5), 1.5);
      }
    };

    // Main trunk
    drawCactusSegment(x, y, 14, 75);
    g.fillStyle(COL_CACTUS);
    g.fillCircle(x, y - 75, 7);

    // Left arm
    drawCactusSegment(x - 20, y - 40, 10, 22);
    drawCactusSegment(x - 20, y - 62, 10, 26);
    g.fillCircle(x - 20, y - 88, 6);

    // Right arm
    drawCactusSegment(x + 18, y - 35, 10, 18);
    drawCactusSegment(x + 18, y - 53, 10, 22);
    g.fillCircle(x + 18, y - 75, 6);

    // Connector arms
    g.fillStyle(COL_CACTUS);
    g.fillRoundedRect(x - 28, y - 42, 18, 8, 4);
    g.fillRoundedRect(x + 10, y - 37, 16, 8, 4);
  }
}
