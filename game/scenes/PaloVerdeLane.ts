import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Bug } from '../objects/Bug';
import {
  gridToScreen, screenToGrid,
  TILE_HW, TILE_HH,
  GRID_SIZE,
  COL_TERRACOTTA, COL_SAGE, COL_MOXIE,
  COL_STUCCO, COL_CACTUS,
} from '../constants';
import { emitShowCatchCard, onCatchCardDismissed } from '../eventBus';

const CATCH_RADIUS = 1.6;
const RING_MIN = 8;
const RING_MAX = 44;
const RING_SPEED = 60;
const CATCH_WINDOW_MAX = 22;
const BUG_TAP_RADIUS = 24;
const SPAWN_REVEAL_RADIUS = 1.5;

const SAND_LIGHT = [0xE8C99A, 0xEBCFA0, 0xE4C496, 0xEDD6A8, 0xE6CB97];
const SAND_DARK  = [0xD4A76A, 0xD8AB70, 0xCFA265, 0xD6A96C, 0xD0A468];

type ScreenId = 'cul-de-sac' | 'back-alley' | 'the-park' | 'moxie-hq';

interface SpawnPointDef {
  gx: number;
  gy: number;
  bugType: number;
}

interface RuntimeSpawnPoint extends SpawnPointDef {
  triggered: boolean;
  bug: Bug | null;
}

interface ScreenDef {
  id: ScreenId;
  name: string;
  connections: { east?: ScreenId; west?: ScreenId; north?: ScreenId; south?: ScreenId };
  spawnPoints: SpawnPointDef[];
}

const SCREENS: Record<ScreenId, ScreenDef> = {
  'cul-de-sac': {
    id: 'cul-de-sac',
    name: 'The Cul-de-sac',
    connections: { east: 'back-alley', south: 'the-park' },
    spawnPoints: [
      { gx: 6, gy: 9, bugType: 0 },
      { gx: 3, gy: 4, bugType: 4 },
      { gx: 10, gy: 6, bugType: 2 },
    ],
  },
  'back-alley': {
    id: 'back-alley',
    name: 'Back Alley',
    connections: { west: 'cul-de-sac', south: 'moxie-hq' },
    spawnPoints: [
      { gx: 4, gy: 5, bugType: 1 },
      { gx: 9, gy: 9, bugType: 3 },
      { gx: 7, gy: 2, bugType: 0 },
    ],
  },
  'the-park': {
    id: 'the-park',
    name: 'The Park',
    connections: { north: 'cul-de-sac', east: 'moxie-hq' },
    spawnPoints: [
      { gx: 4, gy: 6, bugType: 3 },
      { gx: 9, gy: 4, bugType: 4 },
      { gx: 7, gy: 11, bugType: 1 },
    ],
  },
  'moxie-hq': {
    id: 'moxie-hq',
    name: 'Moxie HQ',
    connections: { north: 'back-alley', west: 'the-park' },
    spawnPoints: [
      { gx: 5, gy: 7, bugType: 2 },
      { gx: 10, gy: 4, bugType: 0 },
      { gx: 3, gy: 11, bugType: 4 },
    ],
  },
};

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

  // Camera follow proxy (invisible 1px rect the camera tracks)
  private playerFollowTarget!: Phaser.GameObjects.Rectangle;

  // Multi-screen
  private currentScreenId: ScreenId = 'cul-de-sac';
  private envObjects: Phaser.GameObjects.GameObject[] = [];
  private spawnPoints: RuntimeSpawnPoint[] = [];
  private transitioning = false;
  private paused = false;
  private catchCardUnsubscribe: (() => void) | null = null;

  constructor() {
    super({ key: 'PaloVerdeLane' });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create() {
    // Sky: warm Arizona sunset gradient
    const sky = this.add.graphics().setDepth(-2);
    sky.fillGradientStyle(0x0D1B4A, 0x0D1B4A, 0xE8604A, 0xE8604A);
    sky.fillRect(-3200, -3200, 8000, 3840);
    sky.fillStyle(0xFFB347);
    sky.fillRect(-3200, 405, 8000, 4400);

    this.drawGround();

    this.player = new Player(this, 7, 7);

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

    // Listen for catch card dismiss from React
    this.catchCardUnsubscribe = onCatchCardDismissed(() => {
      this.paused = false;
      this.catchTarget = null;
      this.ringRadius = RING_MIN;
      this.ringDir = 1;
    });

    this.events.on('shutdown', () => {
      if (this.catchCardUnsubscribe) this.catchCardUnsubscribe();
    });

    // Load first screen (no fade on initial load)
    this.loadScreen('cul-de-sac', 7, 7, false);

    // Camera follow: invisible proxy rect tracks the player position each frame
    const startPos = gridToScreen(7, 7);
    this.playerFollowTarget = this.add.rectangle(startPos.x, startPos.y, 1, 1).setAlpha(0).setDepth(-100);
    this.cameras.main.startFollow(this.playerFollowTarget, true, 0.1, 0.1);
    this.cameras.main.setFollowOffset(0, 0);
  }

  update(_time: number, delta: number) {
    if (this.transitioning || this.paused) return;

    const keyboardMoved = this.handleKeyboard(delta);

    if (this.pointerHeld && !this.catchTarget && !keyboardMoved) {
      const { gx, gy } = screenToGrid(this.heldWorldX, this.heldWorldY);
      this.player.moveTo(gx, gy);
    }

    const tapMoved = this.player.updateMove(delta);

    if (!keyboardMoved && !tapMoved) {
      this.player.setIdle();
    }

    // Apply soft walls for edges without connections
    const screen = SCREENS[this.currentScreenId];
    if (!screen.connections.east)  this.player.gx = Math.min(this.player.gx, 12.7);
    if (!screen.connections.west)  this.player.gx = Math.max(this.player.gx, 0.3);
    if (!screen.connections.south) this.player.gy = Math.min(this.player.gy, 12.7);
    if (!screen.connections.north) this.player.gy = Math.max(this.player.gy, 0.3);

    // Bug AI
    for (const bug of this.bugs) {
      if (!bug.caught) bug.update(delta, this.player.gx, this.player.gy);
    }

    // Camera follow: update proxy so startFollow tracks the player
    const { x: px, y: py } = this.player.getScreenPos();
    this.playerFollowTarget.setPosition(px, py);

    // Catch mini-game
    this.updateCatchGame(delta);

    // Spawn point proximity check
    this.checkSpawnPoints();

    // Edge transition check
    this.checkEdgeTransition();

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
      this.player.stopMove();
      return true;
    }
    return false;
  }

  private handlePointerDown(ptr: Phaser.Input.Pointer) {
    if (this.paused || this.transitioning) return;

    if (this.catchTarget) {
      this.attemptCatch();
      return;
    }

    for (const bug of this.bugs) {
      if (bug.caught || bug.hidden) continue;
      const distToPlayer = Math.hypot(bug.gx - this.player.gx, bug.gy - this.player.gy);
      if (distToPlayer < CATCH_RADIUS) {
        const { x: bx, y: by } = bug.getScreenPos();
        if (Math.hypot(ptr.worldX - bx, ptr.worldY - by) < BUG_TAP_RADIUS) {
          this.attemptCatch();
          return;
        }
      }
    }

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
      if (bug.caught || bug.hidden) continue;
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
      this.ringRadius += this.ringDir * RING_SPEED * (delta / 1000);
      if (this.ringRadius >= RING_MAX) { this.ringRadius = RING_MAX; this.ringDir = -1; }
      if (this.ringRadius <= RING_MIN) { this.ringRadius = RING_MIN; this.ringDir = 1; }

      const inWindow = this.ringRadius <= CATCH_WINDOW_MAX;
      const { x, y } = nearest.getScreenPos();
      const oy = y - 10;

      this.catchRing.clear();

      this.catchRing.fillStyle(0x00FF88, inWindow ? 0.22 : 0.08);
      this.catchRing.fillCircle(x, oy, CATCH_WINDOW_MAX);

      this.catchRing.lineStyle(2, 0x00FF88, 0.85);
      this.catchRing.strokeCircle(x, oy, CATCH_WINDOW_MAX);

      this.catchRing.lineStyle(5, inWindow ? 0x00FF88 : 0xFFAA00, 0.95);
      this.catchRing.strokeCircle(x, oy, this.ringRadius);

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

    // Sparkle burst
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

    bug.destroy();

    // Pause game and show catch card
    this.paused = true;
    this.catchRing.clear();
    this.promptText.setAlpha(0);

    emitShowCatchCard({
      id: bug.id,
      name: bug.typeData.name,
      color: bug.typeData.color,
      description: bug.typeData.description,
      fact: bug.typeData.fact,
      rarity: bug.typeData.rarity,
      caughtAt: Date.now(),
    });

    this.ringRadius = RING_MIN;
    this.ringDir = 1;
    this.catchTarget = null;
  }

  private flashMiss() {
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

  // ─── Spawn Points ─────────────────────────────────────────────────────────

  private checkSpawnPoints() {
    for (const sp of this.spawnPoints) {
      if (sp.triggered) continue;
      const dist = Math.hypot(this.player.gx - sp.gx, this.player.gy - sp.gy);
      if (dist < SPAWN_REVEAL_RADIUS) {
        this.triggerSpawnPoint(sp);
      }
    }
  }

  private triggerSpawnPoint(sp: RuntimeSpawnPoint) {
    sp.triggered = true;
    const { x, y } = gridToScreen(sp.gx, sp.gy);

    // "!" popup
    const exclaim = this.add.text(x, y - 30, '!', {
      fontSize: '36px', fontStyle: 'bold',
      color: '#FF4400', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(250);
    this.tweens.add({
      targets: exclaim, y: y - 62, alpha: 0, duration: 750, ease: 'Back.easeOut',
      onComplete: () => exclaim.destroy(),
    });

    // Dust cloud
    const dust = this.add.graphics().setDepth(249);
    dust.fillStyle(0xD4B896, 0.65);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const r = 7 + Math.random() * 7;
      dust.fillCircle(x + Math.cos(angle) * 14, y - 8 + Math.sin(angle) * 9, r);
    }
    this.tweens.add({
      targets: dust, alpha: 0, scaleX: 2.2, scaleY: 2.2, duration: 600,
      onComplete: () => dust.destroy(),
    });

    // Create and reveal bug
    const bug = new Bug(this, sp.gx, sp.gy, sp.bugType);
    bug.reveal();
    sp.bug = bug;
    this.bugs.push(bug);
  }

  // ─── Screen Management ────────────────────────────────────────────────────

  private checkEdgeTransition() {
    const screen = SCREENS[this.currentScreenId];
    let targetId: ScreenId | undefined;
    let newGx = this.player.gx;
    let newGy = this.player.gy;

    if (this.player.gx > 13.5 && screen.connections.east) {
      targetId = screen.connections.east;
      newGx = 0.5;
    } else if (this.player.gx < 0.5 && screen.connections.west) {
      targetId = screen.connections.west;
      newGx = 13.5;
    } else if (this.player.gy > 13.5 && screen.connections.south) {
      targetId = screen.connections.south;
      newGy = 0.5;
    } else if (this.player.gy < 0.5 && screen.connections.north) {
      targetId = screen.connections.north;
      newGy = 13.5;
    }

    if (targetId) {
      this.transitioning = true;
      this.pointerHeld = false;
      this.player.stopMove();
      const finalGx = newGx;
      const finalGy = newGy;
      const finalId = targetId;
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.loadScreen(finalId, finalGx, finalGy, true);
        // Snap camera to new player position before fade-in
        const { x: nx, y: ny } = this.player.getScreenPos();
        this.cameras.main.stopFollow();
        this.playerFollowTarget.setPosition(nx, ny);
        this.cameras.main.centerOn(nx, ny);
        this.cameras.main.startFollow(this.playerFollowTarget, true, 0.1, 0.1);
        this.cameras.main.setFollowOffset(0, 0);
        this.cameras.main.fadeIn(300, 0, 0, 0);
        this.cameras.main.once('camerafadeincomplete', () => {
          this.transitioning = false;
        });
      });
    }
  }

  private loadScreen(screenId: ScreenId, playerGx: number, playerGy: number, showLabel: boolean) {
    // Destroy current environment
    for (const obj of this.envObjects) obj.destroy();
    this.envObjects = [];

    // Destroy all bugs
    for (const bug of this.bugs) bug.destroy();
    this.bugs = [];

    // Clear catch state
    this.catchTarget = null;
    if (this.catchRing) this.catchRing.clear();
    if (this.promptText) this.promptText.setAlpha(0);

    this.currentScreenId = screenId;
    this.player.gx = playerGx;
    this.player.gy = playerGy;

    // Draw environment for this screen
    this.drawScreenEnvironment(screenId);

    // Init spawn points (all untriggered, no bugs yet)
    const screen = SCREENS[screenId];
    this.spawnPoints = screen.spawnPoints.map(sp => ({ ...sp, triggered: false, bug: null }));

    // Show screen name label on transition
    if (showLabel) {
      const sw = this.scale.width / this.zoom;
      const sh = this.scale.height / this.zoom;
      const label = this.add.text(sw / 2, sh * 0.18, screen.name, {
        fontSize: `${Math.round(26 / this.zoom)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 20, y: 10 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
      this.tweens.add({
        targets: label, alpha: 0, delay: 1800, duration: 600,
        onComplete: () => label.destroy(),
      });
    }
  }

  // ─── Environment helpers ──────────────────────────────────────────────────

  private addEnvGraphics(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    this.envObjects.push(g);
    return g;
  }

  private drawScreenEnvironment(screenId: ScreenId) {
    switch (screenId) {
      case 'cul-de-sac': this.drawCulDeSac(); break;
      case 'back-alley':  this.drawBackAlley(); break;
      case 'the-park':    this.drawThePark(); break;
      case 'moxie-hq':    this.drawMoxieHQ(); break;
    }
  }

  // ─── Ground (permanent, drawn once) ──────────────────────────────────────

  private drawGround() {
    const g = this.add.graphics().setDepth(-1);

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const { x, y } = gridToScreen(gx, gy);
        const alt = (gx + gy) % 2 === 0;
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

  // ─── Per-screen environment layouts ──────────────────────────────────────

  private drawCulDeSac() {
    this.drawHouse(0, 0);
    this.drawHouse(10, 2);
    this.drawPaloVerde(3, 3);
    this.drawPaloVerde(8, 1);
    this.drawPaloVerde(2, 10);
    this.drawSaguaro(6, 8);
    this.drawSaguaro(11, 11);
    this.drawRock(5, 5);
    this.drawRock(9, 9);
    this.drawRock(1, 12);
  }

  private drawBackAlley() {
    this.drawBackWall(0, 2);
    this.drawBackWall(9, 0);
    this.drawDumpster(3, 5);
    this.drawDumpster(8, 7);
    this.drawRock(2, 3);
    this.drawRock(6, 2);
    this.drawRock(11, 9);
    this.drawRock(5, 11);
    this.drawPaloVerde(12, 4);
    this.drawPaloVerde(1, 12);
  }

  private drawThePark() {
    this.drawPaloVerde(2, 3);
    this.drawPaloVerde(5, 2);
    this.drawPaloVerde(10, 5);
    this.drawPaloVerde(3, 11);
    this.drawPaloVerde(11, 12);
    this.drawBench(6, 7);
    this.drawBench(10, 10);
    this.drawPlayground(7, 4);
    this.drawRock(1, 8);
  }

  private drawMoxieHQ() {
    this.drawOfficeBuilding(0, 0);
    this.drawMoxieTruck(9, 8);
    this.drawPottedPlant(6, 6);
    this.drawPottedPlant(8, 11);
    this.drawSaguaro(12, 2);
    this.drawRock(4, 12);
  }

  // ─── Drawing helpers ──────────────────────────────────────────────────────

  private drawHouse(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 3);
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

  private drawBackWall(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 3);
    const { x, y } = gridToScreen(gx, gy);
    const hw = TILE_HW;
    const wallH = 40;

    // Plain gray back of house
    g.fillStyle(0xB0B0A8);
    g.beginPath();
    g.moveTo(x - hw, y);
    g.lineTo(x,       y + TILE_HH);
    g.lineTo(x,       y + TILE_HH - wallH);
    g.lineTo(x - hw, y - wallH);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xC8C8C0);
    g.beginPath();
    g.moveTo(x,       y + TILE_HH);
    g.lineTo(x + hw,  y);
    g.lineTo(x + hw,  y - wallH);
    g.lineTo(x,       y + TILE_HH - wallH);
    g.closePath();
    g.fillPath();

    // Small back window
    g.fillStyle(0x87CEEB, 0.7);
    g.fillRect(x + 8, y - wallH + 10, 12, 10);

    // Flat roof
    g.fillStyle(0x888880);
    g.beginPath();
    g.moveTo(x - hw, y - wallH);
    g.lineTo(x,       y + TILE_HH - wallH);
    g.lineTo(x + hw,  y - wallH);
    g.lineTo(x,       y - wallH - 4);
    g.closePath();
    g.fillPath();
  }

  private drawDumpster(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);
    const w = 28;
    const h = 30;

    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(x, y + 2, w + 8, 10);

    // Body (dark green metal)
    g.fillStyle(0x2A5F3A);
    g.fillRoundedRect(x - w / 2, y - h, w, h, 3);

    // Lid
    g.fillStyle(0x1A4A2A);
    g.fillRoundedRect(x - w / 2 - 2, y - h - 5, w + 4, 8, 2);

    // Lid handle
    g.fillStyle(0x888888);
    g.fillRect(x - 6, y - h - 7, 12, 3);

    // Grime detail lines
    g.lineStyle(1, 0x1A4A2A, 0.5);
    g.lineBetween(x - w / 2 + 4, y - h + 5, x - w / 2 + 4, y - 2);
    g.lineBetween(x + w / 2 - 4, y - h + 5, x + w / 2 - 4, y - 2);
  }

  private drawPaloVerde(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 2);
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
    const g = this.addEnvGraphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);

    g.fillStyle(0x000000, 0.14);
    g.fillEllipse(x + 8, y + 2, 28, 10);

    const drawSeg = (cx: number, cy: number, w: number, h: number) => {
      g.fillStyle(COL_CACTUS);
      g.fillRoundedRect(cx - w / 2, cy - h, w, h, w / 2);
      g.lineStyle(1, 0x3A6040, 0.4);
      for (let i = 1; i < 4; i++) {
        const ry = cy - h + (h / 4) * i;
        g.lineBetween(cx - w / 2 + 1, ry, cx + w / 2 - 1, ry);
      }
      g.fillStyle(0xE8C99A);
      for (let i = 0; i < 3; i++) {
        g.fillCircle(cx - w / 2 + 2, cy - h + (h / 3) * (i + 0.5), 1.5);
        g.fillCircle(cx + w / 2 - 2, cy - h + (h / 3) * (i + 0.5), 1.5);
      }
    };

    drawSeg(x, y, 14, 75);
    g.fillStyle(COL_CACTUS);
    g.fillCircle(x, y - 75, 7);

    drawSeg(x - 20, y - 40, 10, 22);
    drawSeg(x - 20, y - 62, 10, 26);
    g.fillCircle(x - 20, y - 88, 6);

    drawSeg(x + 18, y - 35, 10, 18);
    drawSeg(x + 18, y - 53, 10, 22);
    g.fillCircle(x + 18, y - 75, 6);

    g.fillStyle(COL_CACTUS);
    g.fillRoundedRect(x - 28, y - 42, 18, 8, 4);
    g.fillRoundedRect(x + 10, y - 37, 16, 8, 4);
  }

  private drawRock(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 1);
    const { x, y } = gridToScreen(gx, gy);

    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(x + 4, y + 2, 32, 10);

    g.fillStyle(0xA0998A);
    g.fillEllipse(x, y - 8, 26, 20);
    g.fillStyle(0xB8B0A0);
    g.fillEllipse(x - 4, y - 11, 18, 13);
  }

  private drawBench(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);

    // Seat
    g.fillStyle(0x8B5E3C);
    g.fillRect(x - 22, y - 14, 44, 6);
    // Back rest
    g.fillRect(x - 22, y - 26, 44, 5);
    // Legs
    g.fillRect(x - 18, y - 8, 5, 12);
    g.fillRect(x + 13, y - 8, 5, 12);
    // Armrests
    g.fillStyle(0x6B4020);
    g.fillRect(x - 24, y - 26, 5, 18);
    g.fillRect(x + 19, y - 26, 5, 18);
    // Ground shadow
    g.fillStyle(0x000000, 0.10);
    g.fillEllipse(x, y + 2, 40, 8);
  }

  private drawPlayground(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);

    // Slide frame poles
    g.lineStyle(3, 0xE05020, 1.0);
    g.lineBetween(x - 22, y - 44, x - 22, y);
    g.lineBetween(x + 22, y - 44, x + 22, y);
    g.lineBetween(x - 22, y - 44, x + 22, y - 44);

    // Platform
    g.fillStyle(0xE05020, 0.9);
    g.fillRect(x - 22, y - 50, 44, 6);

    // Slide ramp (yellow)
    g.lineStyle(5, 0xFFD700, 0.9);
    g.lineBetween(x + 22, y - 44, x + 46, y - 10);

    // Swing frame
    g.lineStyle(2, 0x888888, 0.8);
    g.lineBetween(x - 40, y - 44, x - 40, y);
    g.lineBetween(x - 20, y - 44, x - 20, y);
    g.lineBetween(x - 40, y - 44, x - 20, y - 44);

    // Swing chains + seat
    g.lineStyle(1.5, 0x666666, 0.7);
    g.lineBetween(x - 37, y - 44, x - 34, y - 24);
    g.lineBetween(x - 23, y - 44, x - 26, y - 24);
    g.fillStyle(0x8B5E3C);
    g.fillRect(x - 35, y - 26, 10, 4);
  }

  private drawOfficeBuilding(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 5);
    const { x, y } = gridToScreen(gx, gy);
    const hw = TILE_HW * 2.2;
    const wallH = 95;

    // Left wall
    g.fillStyle(0xD0D0D8);
    g.beginPath();
    g.moveTo(x - hw, y);
    g.lineTo(x,       y + TILE_HH * 2);
    g.lineTo(x,       y + TILE_HH * 2 - wallH);
    g.lineTo(x - hw, y - wallH);
    g.closePath();
    g.fillPath();

    // Front wall (glass facade)
    g.fillStyle(0xC8E8F8);
    g.beginPath();
    g.moveTo(x,       y + TILE_HH * 2);
    g.lineTo(x + hw,  y);
    g.lineTo(x + hw,  y - wallH);
    g.lineTo(x,       y + TILE_HH * 2 - wallH);
    g.closePath();
    g.fillPath();

    // Window grid on front face
    g.fillStyle(0x87CEEB, 0.65);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        g.fillRect(x + 8 + col * 26, y - wallH + 12 + row * 24, 18, 16);
      }
    }

    // Moxie green sign band
    g.fillStyle(COL_MOXIE, 0.9);
    g.fillRect(x + 6, y - wallH + wallH * 0.62, hw * 0.85, 14);

    // Flat roof
    g.fillStyle(0xA8A8B8);
    g.beginPath();
    g.moveTo(x - hw, y - wallH);
    g.lineTo(x,       y + TILE_HH * 2 - wallH);
    g.lineTo(x + hw,  y - wallH);
    g.lineTo(x,       y - wallH - 6);
    g.closePath();
    g.fillPath();

    // Entry door (double glass)
    g.fillStyle(0x2D6A4F);
    g.fillRect(x + 14, y + TILE_HH * 2 - wallH, 22, 38);
    g.fillStyle(0xAADDCC, 0.5);
    g.fillRect(x + 16, y + TILE_HH * 2 - wallH + 2, 8, 34);
    g.fillRect(x + 26, y + TILE_HH * 2 - wallH + 2, 8, 34);
  }

  private drawMoxieTruck(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);

    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(x + 5, y + 2, 62, 12);

    // Van body (Moxie green)
    g.fillStyle(COL_MOXIE);
    g.fillRoundedRect(x - 28, y - 32, 52, 28, 4);

    // Cab
    g.fillStyle(0x1A4A30);
    g.fillRoundedRect(x + 14, y - 42, 20, 22, 3);

    // Windshield
    g.fillStyle(0x87CEEB, 0.8);
    g.fillRoundedRect(x + 16, y - 40, 16, 14, 2);

    // Side windows
    g.fillStyle(0x87CEEB, 0.6);
    g.fillRect(x - 22, y - 30, 14, 10);
    g.fillRect(x - 4, y - 30, 14, 10);

    // Wheels
    g.fillStyle(0x333333);
    g.fillCircle(x - 15, y + 1, 7);
    g.fillCircle(x + 16, y + 1, 7);
    g.fillStyle(0x888888);
    g.fillCircle(x - 15, y + 1, 4);
    g.fillCircle(x + 16, y + 1, 4);

    // White side panel (logo area)
    g.fillStyle(0xFFFFFF, 0.8);
    g.fillRect(x - 18, y - 24, 26, 10);
    g.fillStyle(COL_MOXIE, 0.9);
    g.fillRect(x - 16, y - 22, 22, 6);
  }

  private drawPottedPlant(gx: number, gy: number) {
    const g = this.addEnvGraphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);

    // Pot (terracotta trapezoid via polygon)
    g.fillStyle(COL_TERRACOTTA);
    g.beginPath();
    g.moveTo(x - 8, y - 16);
    g.lineTo(x + 8, y - 16);
    g.lineTo(x + 10, y);
    g.lineTo(x - 10, y);
    g.closePath();
    g.fillPath();

    // Soil line at top of pot
    g.fillStyle(0x6B4020);
    g.fillRect(x - 8, y - 18, 16, 4);

    // Leaves
    g.fillStyle(COL_SAGE);
    g.fillCircle(x, y - 28, 13);
    g.fillCircle(x - 9, y - 23, 10);
    g.fillCircle(x + 9, y - 23, 10);
    g.fillStyle(0x6B9A60, 0.6);
    g.fillCircle(x + 4, y - 26, 9);

    // Shadow
    g.fillStyle(0x000000, 0.10);
    g.fillEllipse(x, y + 2, 24, 8);
  }
}
