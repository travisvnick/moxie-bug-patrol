import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Bug } from '../objects/Bug';
import { VirtualJoystick } from '../objects/VirtualJoystick';
import {
  gridToScreen,
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
  private joystick!: VirtualJoystick;
  private keys!: KeySet;

  // Catch mini-game
  private catchRing!: Phaser.GameObjects.Graphics;
  private catchTarget: Bug | null = null;
  private ringRadius = RING_MIN;
  private ringDir = 1;

  // HUD
  private promptText!: Phaser.GameObjects.Text;
  private catchBtn!: Phaser.GameObjects.Graphics;
  private catchBtnText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private caughtCount = 0;

  constructor() {
    super({ key: 'PaloVerdeLane' });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create() {
    // Sky
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x5BA3C9, 0x5BA3C9, 0xB8D4E8, 0xB8D4E8);
    sky.fillRect(0, 0, CANVAS_W, CANVAS_H * 0.45);
    sky.fillStyle(0xD4A76A);
    sky.fillRect(0, CANVAS_H * 0.45, CANVAS_W, CANVAS_H * 0.55);

    // Ground tiles
    this.drawGround();

    // Static environment objects (sorted by depth manually)
    this.drawEnvironment();

    // Player starts near center
    this.player = new Player(this, 7, 7);

    // Bugs — 5 bugs spread across the grid
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

    // Input
    if (this.input.keyboard) {
      this.keys = Object.assign(this.input.keyboard.createCursorKeys(), {
        w: this.input.keyboard.addKey('W'),
        a: this.input.keyboard.addKey('A'),
        s: this.input.keyboard.addKey('S'),
        d: this.input.keyboard.addKey('D'),
        space: this.input.keyboard.addKey('SPACE'),
      });
    }

    // Virtual joystick (bottom-left)
    this.joystick = new VirtualJoystick(this, 110, CANVAS_H - 110);

    // Catch ring (drawn each frame)
    this.catchRing = this.add.graphics().setDepth(200);

    // Catch button (bottom-right, touch)
    this.catchBtn = this.add.graphics().setScrollFactor(0).setDepth(201);
    this.drawCatchButton(false);

    this.catchBtnText = this.add.text(CANVAS_W - 100, CANVAS_H - 110, 'NET!', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1A4030',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setAlpha(0);

    // Prompt text (bottom centre)
    this.promptText = this.add.text(CANVAS_W / 2, CANVAS_H - 30, '', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 12, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setAlpha(0);

    // Score / title (top-left)
    this.scoreText = this.add.text(18, 16, 'Bugs caught: 0', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#2D6A4F',
      backgroundColor: '#ffffffcc',
      padding: { x: 10, y: 5 },
    }).setScrollFactor(0).setDepth(202);

    // Touch catch — right half of screen
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.x > CANVAS_W / 2) this.attemptCatch();
    });
  }

  update(_time: number, delta: number) {
    this.handleInput(delta);
    for (const bug of this.bugs) {
      if (!bug.caught) bug.update(delta, this.player.gx, this.player.gy);
    }
    this.updateCatchGame(delta);

    if (this.keys?.space && Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      this.attemptCatch();
    }
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  private handleInput(delta: number) {
    let sdx = 0;
    let sdy = 0;

    if (this.keys) {
      if (this.keys.left.isDown || this.keys.a.isDown)  sdx -= 1;
      if (this.keys.right.isDown || this.keys.d.isDown) sdx += 1;
      if (this.keys.up.isDown || this.keys.w.isDown)    sdy -= 1;
      if (this.keys.down.isDown || this.keys.s.isDown)  sdy += 1;
    }

    if (Math.abs(this.joystick.dx) > 0.05 || Math.abs(this.joystick.dy) > 0.05) {
      sdx = this.joystick.dx;
      sdy = this.joystick.dy;
    }

    if (sdx !== 0 || sdy !== 0) {
      // Normalise diagonal keyboard input
      const len = Math.hypot(sdx, sdy);
      this.player.move(sdx / len, sdy / len, delta);
    }
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
      const oy = y - 10; // offset to sprite center

      this.catchRing.clear();
      // Green "sweet spot" zone indicator
      this.catchRing.lineStyle(2, 0x00FF88, 0.4);
      this.catchRing.strokeCircle(x, oy, CATCH_WINDOW_MAX);
      // Animated ring
      this.catchRing.lineStyle(3, inWindow ? 0x00FF88 : 0xFFFF00, 0.9);
      this.catchRing.strokeCircle(x, oy, this.ringRadius);

      this.promptText.setText('Press SPACE  or tap NET! to catch!').setAlpha(1);
      this.drawCatchButton(true);
      this.catchBtnText.setAlpha(1);
    } else {
      this.catchRing.clear();
      this.promptText.setAlpha(0);
      this.drawCatchButton(false);
      this.catchBtnText.setAlpha(0);
    }
  }

  private attemptCatch() {
    if (!this.catchTarget) return;
    const inWindow = this.ringRadius <= CATCH_WINDOW_MAX;
    if (inWindow) {
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

    // Flash
    const flash = this.add.graphics().setDepth(300);
    flash.fillStyle(0xFFFFFF, 0.85);
    flash.fillCircle(x, y - 10, 28);
    this.tweens.add({
      targets: flash, alpha: 0, scaleX: 2.2, scaleY: 2.2,
      duration: 350, onComplete: () => flash.destroy(),
    });

    // Floating label
    const label = this.add.text(x, y - 40, `✓ ${bug.typeData.name}!`, {
      fontSize: '17px', fontStyle: 'bold',
      color: '#2D6A4F', backgroundColor: '#ffffffee',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(301);
    this.tweens.add({
      targets: label, y: y - 100, alpha: 0,
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

        g.fillStyle(alt ? COL_SAND : COL_SAND_DARK);
        g.beginPath();
        g.moveTo(x,             y - TILE_HH);
        g.lineTo(x + TILE_HW,  y);
        g.lineTo(x,             y + TILE_HH);
        g.lineTo(x - TILE_HW,  y);
        g.closePath();
        g.fillPath();

        // Subtle grid line
        g.lineStyle(1, 0xC4A876, 0.25);
        g.beginPath();
        g.moveTo(x,             y - TILE_HH);
        g.lineTo(x + TILE_HW,  y);
        g.lineTo(x,             y + TILE_HH);
        g.lineTo(x - TILE_HW,  y);
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

    // Front wall face (right side of iso cube)
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

    // Trunk (yellow-green — palo verde = "green stick" in Spanish)
    g.fillStyle(0x9CB850);
    g.fillRoundedRect(x - 5, y - 50, 10, 50, 5);

    // Main branches
    g.lineStyle(4, 0x8FAF7E);
    g.lineBetween(x - 2, y - 35, x - 22, y - 58);
    g.lineBetween(x + 2, y - 35, x + 22, y - 58);
    g.lineBetween(x,     y - 42, x,      y - 66);
    g.lineStyle(3, 0x8FAF7E);
    g.lineBetween(x - 20, y - 55, x - 30, y - 68);
    g.lineBetween(x + 20, y - 55, x + 30, y - 68);

    // Foliage puffs (light, airy)
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

    // Yellow flowers (palo verde hallmark)
    for (const p of puffs.slice(0, 4)) {
      g.fillStyle(0xFFD700);
      g.fillCircle(p.px + Phaser.Math.Between(-6, 6), p.py + Phaser.Math.Between(-4, 4), 2.5);
    }
  }

  private drawSaguaro(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);

    const drawCactusSegment = (cx: number, cy: number, w: number, h: number) => {
      g.fillStyle(COL_CACTUS);
      g.fillRoundedRect(cx - w / 2, cy - h, w, h, w / 2);
      // Ribs
      g.lineStyle(1, 0x3A6040, 0.4);
      for (let i = 1; i < 4; i++) {
        const ry = cy - h + (h / 4) * i;
        g.lineBetween(cx - w / 2 + 1, ry, cx + w / 2 - 1, ry);
      }
      // Spines (dots)
      g.fillStyle(0xE8C99A);
      for (let i = 0; i < 3; i++) {
        g.fillCircle(cx - w / 2 + 2, cy - h + (h / 3) * (i + 0.5), 1.5);
        g.fillCircle(cx + w / 2 - 2, cy - h + (h / 3) * (i + 0.5), 1.5);
      }
    };

    // Main trunk
    drawCactusSegment(x, y, 14, 75);
    // Top cap
    g.fillStyle(COL_CACTUS);
    g.fillCircle(x, y - 75, 7);

    // Left arm (elbow up)
    drawCactusSegment(x - 20, y - 40, 10, 22);
    drawCactusSegment(x - 20, y - 62, 10, 26);
    g.fillCircle(x - 20, y - 88, 6);

    // Right arm (shorter)
    drawCactusSegment(x + 18, y - 35, 10, 18);
    drawCactusSegment(x + 18, y - 53, 10, 22);
    g.fillCircle(x + 18, y - 75, 6);

    // Connector arms (horizontal)
    g.fillStyle(COL_CACTUS);
    g.fillRoundedRect(x - 28, y - 42, 18, 8, 4);
    g.fillRoundedRect(x + 10, y - 37, 16, 8, 4);
  }

  // ─── HUD helper ───────────────────────────────────────────────────────────

  private drawCatchButton(active: boolean) {
    this.catchBtn.clear();
    const bx = CANVAS_W - 100;
    const by = CANVAS_H - 110;
    this.catchBtn.fillStyle(COL_MOXIE, active ? 0.9 : 0.35);
    this.catchBtn.fillCircle(bx, by, 54);
    this.catchBtn.lineStyle(3, 0xffffff, active ? 0.85 : 0.3);
    this.catchBtn.strokeCircle(bx, by, 54);
  }
}
