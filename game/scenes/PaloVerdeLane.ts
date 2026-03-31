import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Bug } from '../objects/Bug';
import {
  gridToScreen, screenToGrid,
  TILE_HW, TILE_HH,
  GRID_SIZE,
  COL_TERRACOTTA, COL_SAGE, COL_MOXIE,
  COL_STUCCO, COL_CACTUS, COL_SAND,
} from '../constants';
import { emitShowCatchCard } from '../eventBus';

const CATCH_RADIUS = 1.6;
const RING_MIN = 8;
const RING_MAX = 44;
const RING_SPEED = 60;
const CATCH_WINDOW_MAX = 22;

const SAND_LIGHT = [0xE8C99A, 0xEBCFA0, 0xE4C496, 0xEDD6A8, 0xE6CB97];
const SAND_DARK  = [0xD4A76A, 0xD8AB70, 0xCFA265, 0xD6A96C, 0xD0A468];

// Exit zone definitions: grid regions that trigger zone transitions
interface ExitZone {
  label: string;
  minGx: number; maxGx: number;
  minGy: number; maxGy: number;
}

const EXIT_ZONES: ExitZone[] = [
  { label: 'Coyote Wash', minGx: 0, maxGx: 1.2, minGy: 8, maxGy: 12 },
  { label: 'Ironwood Trail', minGx: GRID_SIZE - 2.2, maxGx: GRID_SIZE, minGy: 8, maxGy: 12 },
  { label: 'Rattlesnake Ridge', minGx: 8, maxGx: 12, minGy: GRID_SIZE - 2.2, maxGy: GRID_SIZE },
];

// Map layout for the single continuous 20x20 map
const MAP_HOUSES: [number, number][] = [
  [2, 2], [12, 1], [18, 4], [5, 14], [15, 16],
];
const MAP_SAGUAROS: [number, number][] = [
  [1, 7], [5, 4], [9, 1], [14, 6], [17, 2],
  [3, 13], [8, 17], [16, 12], [19, 8], [11, 10],
];
const MAP_TREES: [number, number][] = [
  [3, 3], [8, 2], [13, 5], [10, 8], [2, 10],
  [6, 12], [15, 10], [18, 14],
];
const MAP_ROCKS: [number, number][] = [
  [0, 5], [7, 0], [4, 8], [11, 15], [17, 7],
  [14, 18], [19, 1],
];
const MAP_BUSHES: [number, number][] = [
  [1, 4], [6, 1], [10, 3], [16, 9], [3, 16],
  [12, 13], [18, 17], [8, 11],
];
const MAP_BUGS: [number, number][] = [
  [3, 3], [9, 2], [14, 6], [5, 10], [6, 16],
  [17, 3], [2, 15], [16, 14], [8, 17], [13, 8],
];
const MOXIE_HQ: [number, number] = [10, 5];

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
  private catchActive = false;
  private ringRadius = RING_MIN;
  private ringDir = 1;

  // HUD
  private promptText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private zoneLabel!: Phaser.GameObjects.Text;
  private caughtCount = 0;

  // Hold-to-move
  private pointerHeld = false;
  private heldWorldX = 0;
  private heldWorldY = 0;

  // Zone transition overlay
  private fadeOverlay!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private transitioning = false;

  // Exit zone markers (graphics)
  private exitMarkerGraphics: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super({ key: 'PaloVerdeLane' });
  }

  create() {
    // ─── Desert background fill (covers entire world, no void ever) ──────
    // Use the average of tile colors so edges blend seamlessly
    const desertBg = this.add.graphics().setDepth(-10);
    desertBg.fillStyle(0xDEB882);
    desertBg.fillRect(-20000, -20000, 60000, 60000);

    // Subtle color variation patches in the far desert
    const bgPatches = this.add.graphics().setDepth(-9);
    const patchColors = [0xD4A76A, 0xDDB87A, 0xE0BE85, 0xCFA265];
    for (let i = 0; i < 40; i++) {
      const px = Phaser.Math.Between(-10000, 30000);
      const py = Phaser.Math.Between(-10000, 30000);
      bgPatches.fillStyle(patchColors[i % patchColors.length], 0.25);
      bgPatches.fillEllipse(px, py, Phaser.Math.Between(200, 600), Phaser.Math.Between(100, 300));
    }

    // Sky gradient — desert sky blue fading into sand color
    const sky = this.add.graphics().setDepth(-8);
    // Upper sky: light desert blue
    sky.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xC8E0F0, 0xC8E0F0);
    sky.fillRect(-20000, -20000, 60000, 20000);
    // Horizon band: sky blue fading to warm sand
    sky.fillGradientStyle(0xC8E0F0, 0xC8E0F0, 0xDEB882, 0xDEB882);
    sky.fillRect(-20000, 0, 60000, 3840);

    // ─── Distant scenery beyond border ─────────────────────────────────
    this.drawDistantScenery();

    // ─── Ground tiles ────────────────────────────────────────────────────
    this.drawGround();

    // ─── Natural border wall around perimeter ────────────────────────────
    this.drawBorderWall();

    // ─── Map objects ─────────────────────────────────────────────────────
    this.loadMap();

    // ─── Player ──────────────────────────────────────────────────────────
    this.player = new Player(this, 10, 10, (gx, gy) => this.clampToPlayArea(gx, gy));

    // Keyboard
    if (this.input.keyboard) {
      this.keys = Object.assign(this.input.keyboard.createCursorKeys(), {
        w: this.input.keyboard.addKey('W'),
        a: this.input.keyboard.addKey('A'),
        s: this.input.keyboard.addKey('S'),
        d: this.input.keyboard.addKey('D'),
        space: this.input.keyboard.addKey('SPACE'),
      });
    }

    // Mobile zoom
    if (this.scale.width < 800) {
      this.cameras.main.setZoom(1.3);
    }
    this.zoom = this.cameras.main.zoom;

    // ─── Camera: follow player with bounds ───────────────────────────────
    const topLeft = gridToScreen(0, 0);
    const topRight = gridToScreen(GRID_SIZE - 1, 0);
    const bottomLeft = gridToScreen(0, GRID_SIZE - 1);
    const bottomRight = gridToScreen(GRID_SIZE - 1, GRID_SIZE - 1);

    const minX = bottomLeft.x - TILE_HW - 600;
    const maxX = topRight.x + TILE_HW + 600;
    const minY = topLeft.y - TILE_HH - 600;
    const maxY = bottomRight.y + TILE_HH + 600;

    this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
    this.cameras.main.startFollow(
      { x: 0, y: 0 } as Phaser.GameObjects.GameObject & { x: number; y: number },
      false, 0.1, 0.1,
    );

    const sw = this.scale.width / this.zoom;
    const sh = this.scale.height / this.zoom;

    // Catch ring
    this.catchRing = this.add.graphics().setDepth(200);

    // Prompt text
    this.promptText = this.add.text(sw / 2, sh - 36 / this.zoom, '', {
      fontSize: `${Math.round(18 / this.zoom)}px`,
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 12, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setAlpha(0);

    // Score
    this.scoreText = this.add.text(16 / this.zoom, 14 / this.zoom, 'Bugs caught: 0', {
      fontSize: `${Math.round(18 / this.zoom)}px`,
      fontStyle: 'bold',
      color: '#2D6A4F',
      backgroundColor: '#ffffffcc',
      padding: { x: 10, y: 5 },
    }).setScrollFactor(0).setDepth(202);

    // Zone label
    this.zoneLabel = this.add.text(sw / 2, 14 / this.zoom, 'Palo Verde Lane', {
      fontSize: `${Math.round(16 / this.zoom)}px`,
      fontStyle: 'bold',
      color: '#E8C99A',
      backgroundColor: '#00000088',
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);

    // Hint
    const hint = this.add.text(sw / 2, sh * 0.72, 'Hold to move, tap to catch!', {
      fontSize: `${Math.round(22 / this.zoom)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 16, y: 9 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(210);
    this.tweens.add({
      targets: hint, alpha: 0, delay: 2800, duration: 700,
      onComplete: () => hint.destroy(),
    });

    // Fade overlay for zone transitions
    this.fadeOverlay = this.add.graphics().setDepth(500).setScrollFactor(0).setAlpha(0);
    this.fadeOverlay.fillStyle(0x000000);
    this.fadeOverlay.fillRect(0, 0, this.scale.width / this.zoom + 100, this.scale.height / this.zoom + 100);

    this.loadingText = this.add.text(sw / 2, sh / 2, '', {
      fontSize: `${Math.round(24 / this.zoom)}px`,
      fontStyle: 'bold',
      color: '#E8C99A',
      backgroundColor: '#00000000',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501).setAlpha(0);

    // ─── Exit zone markers (path indicators) ─────────────────────────────
    this.drawExitMarkers();

    // ─── Pointer input ───────────────────────────────────────────────────
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.handlePointerDown(ptr));
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
  }

  update(_time: number, delta: number) {
    if (this.transitioning) return;

    // Keyboard movement
    const keyboardMoved = this.handleKeyboard(delta);

    // Hold-to-move
    if (this.pointerHeld && !this.catchTarget && !keyboardMoved) {
      const { gx, gy } = screenToGrid(this.heldWorldX, this.heldWorldY);
      this.player.moveTo(gx, gy);
    }

    const tapMoved = this.player.updateMove(delta);
    if (!keyboardMoved && !tapMoved) {
      this.player.setIdle();
    }

    // Bug AI + hidden bug reveal detection
    for (const bug of this.bugs) {
      if (bug.caught) continue;

      // Proximity check: reveal hidden bugs when player walks near
      if (bug.hidden) {
        const d = Math.hypot(bug.gx - this.player.gx, bug.gy - this.player.gy);
        if (d < 1.5) {
          bug.reveal();
          // "!" surprise pop
          const { x: bx, y: by } = bug.getScreenPos();
          const bang = this.add.text(bx, by - 30, '!', {
            fontSize: '32px', fontStyle: 'bold',
            color: '#FFD700', stroke: '#000000', strokeThickness: 3,
          }).setOrigin(0.5).setDepth(300);
          this.tweens.add({
            targets: bang, y: by - 70, alpha: 0, duration: 800,
            ease: 'Power2', onComplete: () => bang.destroy(),
          });
        }
        continue; // still hidden this frame — skip AI update
      }

      bug.update(delta, this.player.gx, this.player.gy);
    }

    // Camera follow target — update the invisible follow target
    const { x: px, y: py } = this.player.getScreenPos();
    const followTarget = this.cameras.main.deadzone ? null : null;
    void followTarget;
    // Update the camera follow target position
    (this.cameras.main as Phaser.Cameras.Scene2D.Camera).scrollX = px - (this.cameras.main.width / 2) / this.cameras.main.zoom;
    (this.cameras.main as Phaser.Cameras.Scene2D.Camera).scrollY = py - (this.cameras.main.height / 2) / this.cameras.main.zoom;

    // Clamp camera to bounds manually (setBounds handles this but we override scroll)
    const bounds = this.cameras.main.getBounds();
    const camW = this.cameras.main.width / this.cameras.main.zoom;
    const camH = this.cameras.main.height / this.cameras.main.zoom;
    this.cameras.main.scrollX = Phaser.Math.Clamp(
      this.cameras.main.scrollX, bounds.x, bounds.x + bounds.width - camW,
    );
    this.cameras.main.scrollY = Phaser.Math.Clamp(
      this.cameras.main.scrollY, bounds.y, bounds.y + bounds.height - camH,
    );

    // Catch mini-game
    this.updateCatchGame(delta);

    // SPACE key catch
    if (this.keys?.space && Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      this.attemptCatch();
    }

    // Check exit zones
    this.checkExitZones();
  }

  // ─── Exit zones ────────────────────────────────────────────────────────────

  /** Clamp player position to within the tile grid, allowing passage through exit gaps */
  private clampToPlayArea(gx: number, gy: number): { gx: number; gy: number } {
    // Check if position is inside an exit gap — allow free movement there
    for (const zone of EXIT_ZONES) {
      if (gx >= zone.minGx - 0.5 && gx <= zone.maxGx + 0.5 &&
          gy >= zone.minGy - 0.5 && gy <= zone.maxGy + 0.5) {
        // In an exit gap — allow slightly beyond grid for zone transition trigger
        return {
          gx: Phaser.Math.Clamp(gx, -0.5, GRID_SIZE + 0.5),
          gy: Phaser.Math.Clamp(gy, -0.5, GRID_SIZE + 0.5),
        };
      }
    }
    // Normal play area — stay within the 20x20 tile grid
    return {
      gx: Phaser.Math.Clamp(gx, 0, GRID_SIZE - 1),
      gy: Phaser.Math.Clamp(gy, 0, GRID_SIZE - 1),
    };
  }

  private checkExitZones() {
    const pgx = this.player.gx;
    const pgy = this.player.gy;

    for (const zone of EXIT_ZONES) {
      if (pgx >= zone.minGx && pgx <= zone.maxGx &&
          pgy >= zone.minGy && pgy <= zone.maxGy) {
        this.doZoneTransition(zone.label);
        return;
      }
    }
  }

  private doZoneTransition(zoneName: string) {
    this.transitioning = true;
    this.pointerHeld = false;
    this.player.stopMove();

    this.loadingText.setText(`Walking to ${zoneName}...`);

    this.tweens.add({
      targets: [this.fadeOverlay, this.loadingText],
      alpha: 1,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        // Clear and reload the same map (placeholder)
        this.clearMap();
        this.loadMap();

        // Reposition player to center and hide catch prompt
        this.player.gx = 10;
        this.player.gy = 10;
        this.promptText.setAlpha(0);

        // Snap camera
        const { x, y } = this.player.getScreenPos();
        const cam = this.cameras.main;
        cam.scrollX = x - (cam.width / 2) / cam.zoom;
        cam.scrollY = y - (cam.height / 2) / cam.zoom;

        // Delay then fade back
        this.time.delayedCall(600, () => {
          this.tweens.add({
            targets: [this.fadeOverlay, this.loadingText],
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
              this.transitioning = false;
            },
          });
        });
      },
    });
  }

  private clearMap() {
    for (const bug of this.bugs) bug.destroy();
    this.bugs = [];
    this.catchTarget = null;
    this.catchActive = false;
    this.catchRing.clear();
  }

  private loadMap() {
    // Houses
    for (const [gx, gy] of MAP_HOUSES) this.drawHouse(gx, gy);
    // Moxie HQ
    this.drawMoxieHQ(MOXIE_HQ[0], MOXIE_HQ[1]);
    // Trees
    for (const [gx, gy] of MAP_TREES) this.drawPaloVerde(gx, gy);
    // Saguaros
    for (const [gx, gy] of MAP_SAGUAROS) this.drawSaguaro(gx, gy);
    // Rocks
    for (const [gx, gy] of MAP_ROCKS) this.drawRockPile(gx, gy);
    // Bushes
    for (const [gx, gy] of MAP_BUSHES) this.drawBush(gx, gy);
    // Bugs
    for (let i = 0; i < MAP_BUGS.length; i++) {
      const [gx, gy] = MAP_BUGS[i];
      this.bugs.push(new Bug(this, gx, gy, i % 5));
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
    if (this.transitioning) return;
    if (this.catchActive) { this.attemptCatch(); return; }

    // Tap near a revealed bug to start the catch mini-game.
    // Use generous grid-space distance (~2 tiles) so players don't have to pixel-perfect tap.
    const tapGrid = screenToGrid(ptr.worldX, ptr.worldY);
    for (const bug of this.bugs) {
      if (bug.caught || bug.hidden) continue;
      const bugTapDist = Math.hypot(bug.gx - tapGrid.gx, bug.gy - tapGrid.gy);
      const playerBugDist = Math.hypot(bug.gx - this.player.gx, bug.gy - this.player.gy);
      if (bugTapDist < 2.0 || playerBugDist < CATCH_RADIUS) {
        this.catchTarget = bug;
        this.attemptCatch();
        return;
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
    // While the catch ring is active, keep the target locked even if the bug
    // has run out of CATCH_RADIUS — don't reset the mini-game mid-attempt.
    if (!this.catchActive) {
      // Find nearest catchable bug
      let nearest: Bug | null = null;
      let nearestDist = Infinity;
      for (const bug of this.bugs) {
        if (bug.caught || bug.hidden) continue;
        const d = Math.hypot(bug.gx - this.player.gx, bug.gy - this.player.gy);
        if (d < CATCH_RADIUS && d < nearestDist) { nearest = bug; nearestDist = d; }
      }
      this.catchTarget = nearest;
    }

    // Target gone (caught or no longer exists) — deactivate
    if (!this.catchTarget || this.catchTarget.caught) {
      this.catchActive = false;
      this.catchTarget = null;
      this.catchRing.clear();
      this.promptText.setAlpha(0);
      return;
    }

    // Show prompt hint
    this.promptText.setText('Tap to catch!').setAlpha(1);

    if (!this.catchActive) {
      this.catchRing.clear();
      return;
    }

    // Animate the timing ring
    this.ringRadius += this.ringDir * RING_SPEED * (delta / 1000);
    if (this.ringRadius >= RING_MAX) { this.ringRadius = RING_MAX; this.ringDir = -1; }
    if (this.ringRadius <= RING_MIN) { this.ringRadius = RING_MIN; this.ringDir = 1; }

    const inWindow = this.ringRadius <= CATCH_WINDOW_MAX;
    const { x, y } = this.catchTarget.getScreenPos();
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
  }

  private attemptCatch() {
    if (!this.catchTarget) return;

    // First tap: activate the catch ring
    if (!this.catchActive) {
      this.catchActive = true;
      this.ringRadius = RING_MIN;
      this.ringDir = 1;
      return;
    }

    // Second tap: evaluate timing
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

    const flash = this.add.graphics().setDepth(300);
    flash.fillStyle(0xFFFFFF, 0.85);
    flash.fillCircle(x, y - 10, 28);
    this.tweens.add({
      targets: flash, alpha: 0, scaleX: 2.5, scaleY: 2.5,
      duration: 400, ease: 'Power2', onComplete: () => flash.destroy(),
    });

    const sparkle = this.add.graphics().setDepth(302);
    const rayColors = [0xFFD700, 0xFF69B4, 0x00FF88, 0x87CEEB, 0xFFD700, 0xFF69B4, 0x00FF88, 0x87CEEB];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      sparkle.lineStyle(2.5, rayColors[i], 1.0);
      sparkle.lineBetween(
        x + Math.cos(angle) * 8, y - 10 + Math.sin(angle) * 8,
        x + Math.cos(angle) * 24, y - 10 + Math.sin(angle) * 24,
      );
    }
    this.tweens.add({
      targets: sparkle, alpha: 0, scaleX: 2.0, scaleY: 2.0,
      duration: 550, ease: 'Power2', onComplete: () => sparkle.destroy(),
    });

    const label = this.add.text(x, y - 40, `Caught!\n${bug.typeData.name}`, {
      fontSize: '18px', fontStyle: 'bold',
      color: '#FFD700', stroke: '#1A3A2A', strokeThickness: 3,
      align: 'center', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(301);
    this.tweens.add({
      targets: label, y: y - 110, alpha: 0,
      duration: 1600, ease: 'Power2', onComplete: () => label.destroy(),
    });

    bug.destroy();

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
    this.catchActive = false;
    this.catchRing.clear();
  }

  private flashMiss() {
    if (this.catchTarget) this.catchTarget.boostFlee();
    this.catchActive = false;
    this.catchRing.clear();

    const { x, y } = this.player.getScreenPos();
    const miss = this.add.text(x, y - 55, 'MISS!', {
      fontSize: '22px', fontStyle: 'bold',
      color: '#FF4444', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(301);
    this.tweens.add({
      targets: miss, y: y - 95, alpha: 0, duration: 700,
      onComplete: () => miss.destroy(),
    });
  }

  // ─── Drawing helpers ──────────────────────────────────────────────────────

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
        g.moveTo(x, y - TILE_HH);
        g.lineTo(x + TILE_HW, y);
        g.lineTo(x, y + TILE_HH);
        g.lineTo(x - TILE_HW, y);
        g.closePath();
        g.fillPath();

        g.lineStyle(1, 0xC4A876, 0.20);
        g.beginPath();
        g.moveTo(x, y - TILE_HH);
        g.lineTo(x + TILE_HW, y);
        g.lineTo(x, y + TILE_HH);
        g.lineTo(x - TILE_HW, y);
        g.closePath();
        g.strokePath();
      }
    }
  }

  /** Check if a grid position is inside an exit gap */
  private isExitGap(gx: number, gy: number): boolean {
    for (const zone of EXIT_ZONES) {
      // Widen the gap check slightly for natural look
      if (gx >= zone.minGx - 0.5 && gx <= zone.maxGx + 0.5 &&
          gy >= zone.minGy - 0.5 && gy <= zone.maxGy + 0.5) {
        return true;
      }
    }
    return false;
  }

  /** Draw a continuous natural border wall around the 20x20 grid perimeter */
  private drawBorderWall() {
    const g = this.add.graphics().setDepth(0.5);

    // Walk all four edges of the grid placing border objects
    // Each edge: place rocks, cacti clusters, low walls at each tile along the boundary
    const borderPositions: { gx: number; gy: number; type: string }[] = [];

    // Generate border positions along all 4 edges, 2 tiles thick
    for (let i = -1; i <= GRID_SIZE; i++) {
      // Top edge (gy = -1 and -2)
      for (const offset of [-1, -2]) {
        borderPositions.push({ gx: i, gy: offset, type: this.borderType(i, offset) });
      }
      // Bottom edge (gy = GRID_SIZE and GRID_SIZE+1)
      for (const offset of [GRID_SIZE, GRID_SIZE + 1]) {
        borderPositions.push({ gx: i, gy: offset, type: this.borderType(i, offset) });
      }
      // Left edge (gx = -1 and -2)
      for (const offset of [-1, -2]) {
        borderPositions.push({ gx: offset, gy: i, type: this.borderType(offset, i) });
      }
      // Right edge (gx = GRID_SIZE and GRID_SIZE+1)
      for (const offset of [GRID_SIZE, GRID_SIZE + 1]) {
        borderPositions.push({ gx: offset, gy: i, type: this.borderType(offset, i) });
      }
    }

    for (const pos of borderPositions) {
      // Skip exit gaps — leave dirt path through
      if (this.isExitGap(pos.gx, pos.gy)) continue;

      const { x, y } = gridToScreen(pos.gx, pos.gy);
      const hash = ((pos.gx * 7 + pos.gy * 13) & 0x7FFFFFFF) % 10;

      if (pos.type === 'rock') {
        // Irregular rock formation
        const rScale = 0.8 + (hash % 4) * 0.15;
        g.fillStyle(0xA0876A);
        g.fillEllipse(x, y - 6 * rScale, 30 * rScale, 18 * rScale);
        g.fillStyle(0x8E7860);
        g.fillEllipse(x + 8 * rScale, y - 10 * rScale, 22 * rScale, 14 * rScale);
        g.fillStyle(0xB8A080);
        g.fillEllipse(x - 6 * rScale, y - 3 * rScale, 16 * rScale, 10 * rScale);
        // Highlight
        g.fillStyle(0xC8B898, 0.5);
        g.fillEllipse(x - 2, y - 12 * rScale, 8 * rScale, 4 * rScale);
      } else if (pos.type === 'cactus') {
        // Barrel cactus cluster
        const s = 0.7 + (hash % 3) * 0.2;
        g.fillStyle(0x4A7C59);
        g.fillCircle(x, y - 10 * s, 10 * s);
        g.fillCircle(x + 12 * s, y - 7 * s, 7 * s);
        // Spines
        g.fillStyle(0xE8D8B0);
        for (let sp = 0; sp < 5; sp++) {
          const angle = (sp / 5) * Math.PI * 2;
          g.fillCircle(x + Math.cos(angle) * 8 * s, y - 10 * s + Math.sin(angle) * 8 * s, 1);
        }
        // Shadow
        g.fillStyle(0x000000, 0.1);
        g.fillEllipse(x + 4, y + 2, 24 * s, 8 * s);
      } else {
        // Low desert wall / mesquite bush
        g.fillStyle(0x7A6E50);
        g.fillRoundedRect(x - 20, y - 12, 40, 14, 3);
        g.fillStyle(0x8A7E60, 0.8);
        g.fillRoundedRect(x - 16, y - 18, 32, 10, 3);
        // Bush on top
        g.fillStyle(0x5A7A40, 0.7);
        g.fillCircle(x - 8, y - 20, 8);
        g.fillCircle(x + 6, y - 18, 7);
        g.fillCircle(x, y - 24, 6);
      }
    }
  }

  /** Deterministic border object type based on position */
  private borderType(gx: number, gy: number): string {
    const hash = ((gx * 31 + gy * 17) & 0x7FFFFFFF) % 6;
    if (hash < 3) return 'rock';
    if (hash < 5) return 'cactus';
    return 'wall';
  }

  /** Draw distant desert scenery beyond the border */
  private drawDistantScenery() {
    const g = this.add.graphics().setDepth(-5);

    // Mesa / mountain silhouettes on the horizon (far away, faded)
    const mesaPositions = [
      { gx: -10, gy: -8, w: 300, h: 80 },
      { gx: 25, gy: -6, w: 200, h: 60 },
      { gx: -8, gy: 28, w: 250, h: 70 },
      { gx: 30, gy: 25, w: 280, h: 75 },
      { gx: 10, gy: -12, w: 350, h: 90 },
      { gx: -12, gy: 10, w: 220, h: 65 },
      { gx: 32, gy: 10, w: 240, h: 70 },
      { gx: 10, gy: 32, w: 300, h: 80 },
    ];

    for (const mesa of mesaPositions) {
      const { x, y } = gridToScreen(mesa.gx, mesa.gy);
      // Flat-topped mesa shape
      g.fillStyle(0xC4A07A, 0.35);
      g.beginPath();
      g.moveTo(x - mesa.w / 2, y);
      g.lineTo(x - mesa.w * 0.3, y - mesa.h);
      g.lineTo(x + mesa.w * 0.3, y - mesa.h);
      g.lineTo(x + mesa.w / 2, y);
      g.closePath();
      g.fillPath();
      // Lighter top edge highlight
      g.lineStyle(2, 0xD4B896, 0.3);
      g.lineBetween(x - mesa.w * 0.3, y - mesa.h, x + mesa.w * 0.3, y - mesa.h);
    }

    // Distant faded saguaros scattered far outside
    for (let i = 0; i < 40; i++) {
      let ogx: number, ogy: number;
      const side = i % 4;
      if (side === 0) { ogx = Phaser.Math.Between(-12, -4); ogy = Phaser.Math.Between(-5, GRID_SIZE + 5); }
      else if (side === 1) { ogx = Phaser.Math.Between(GRID_SIZE + 3, GRID_SIZE + 12); ogy = Phaser.Math.Between(-5, GRID_SIZE + 5); }
      else if (side === 2) { ogx = Phaser.Math.Between(-5, GRID_SIZE + 5); ogy = Phaser.Math.Between(-12, -4); }
      else { ogx = Phaser.Math.Between(-5, GRID_SIZE + 5); ogy = Phaser.Math.Between(GRID_SIZE + 3, GRID_SIZE + 12); }

      const { x, y } = gridToScreen(ogx, ogy);
      // Distance-based fade: further = more faded
      const dist = Math.max(
        Math.max(0, -ogx), Math.max(0, ogx - GRID_SIZE),
        Math.max(0, -ogy), Math.max(0, ogy - GRID_SIZE),
      );
      const alpha = Math.max(0.15, 0.5 - dist * 0.03);
      const hash = (i * 7) % 3;

      if (hash === 0) {
        // Distant saguaro
        g.fillStyle(COL_CACTUS, alpha);
        const h = 30 + (i % 5) * 8;
        g.fillRoundedRect(x - 4, y - h, 8, h, 4);
        g.fillRoundedRect(x - 14, y - h * 0.6, 6, 14, 3);
        g.fillRoundedRect(x + 8, y - h * 0.5, 6, 12, 3);
        g.fillCircle(x, y - h, 4);
      } else if (hash === 1) {
        // Distant rock
        g.fillStyle(0xB8A080, alpha);
        g.fillEllipse(x, y, 18, 10);
        g.fillStyle(0xA89070, alpha * 0.8);
        g.fillEllipse(x + 6, y - 2, 12, 8);
      } else {
        // Distant bush
        g.fillStyle(0x6B8E50, alpha);
        g.fillCircle(x, y - 5, 8);
        g.fillCircle(x + 6, y - 3, 6);
      }
    }
  }

  private drawExitMarkers() {
    for (const zone of EXIT_ZONES) {
      const centerGx = (zone.minGx + zone.maxGx) / 2;
      const centerGy = (zone.minGy + zone.maxGy) / 2;
      const { x, y } = gridToScreen(centerGx, centerGy);
      const depth = centerGx + centerGy + 1;

      // Draw a path/road indicator
      const g = this.add.graphics().setDepth(depth);
      this.exitMarkerGraphics.push(g);

      // Dirt path
      g.fillStyle(0xC4A876, 0.6);
      g.fillEllipse(x, y, 80, 30);

      // Arrow or signpost
      g.fillStyle(0x8B5A2B);
      g.fillRect(x - 3, y - 40, 6, 35);
      // Sign board
      g.fillStyle(0xD4A76A);
      g.fillRoundedRect(x - 35, y - 55, 70, 20, 4);

      // Label
      const label = this.add.text(x, y - 45, zone.label, {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#5B3C11',
        align: 'center',
      }).setOrigin(0.5).setDepth(depth + 0.1);

      // Subtle pulsing arrow
      const arrow = this.add.text(x, y + 10, '→', {
        fontSize: '18px', fontStyle: 'bold', color: '#E8C99A',
      }).setOrigin(0.5).setDepth(depth + 0.1);

      this.tweens.add({
        targets: arrow, alpha: 0.3, duration: 800,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  private drawHouse(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 3);
    const { x, y } = gridToScreen(gx, gy);
    const hw = TILE_HW;
    const wallH = 55;

    g.fillStyle(0xD8C8A8);
    g.beginPath();
    g.moveTo(x - hw, y);
    g.lineTo(x, y + TILE_HH);
    g.lineTo(x, y + TILE_HH - wallH);
    g.lineTo(x - hw, y - wallH);
    g.closePath();
    g.fillPath();

    g.fillStyle(COL_STUCCO);
    g.beginPath();
    g.moveTo(x, y + TILE_HH);
    g.lineTo(x + hw, y);
    g.lineTo(x + hw, y - wallH);
    g.lineTo(x, y + TILE_HH - wallH);
    g.closePath();
    g.fillPath();

    g.fillStyle(COL_TERRACOTTA);
    const roofH = 28;
    g.beginPath();
    g.moveTo(x - hw, y - wallH);
    g.lineTo(x, y + TILE_HH - wallH);
    g.lineTo(x + hw, y - wallH);
    g.lineTo(x, y - wallH - roofH);
    g.closePath();
    g.fillPath();

    g.fillStyle(0x8B5A2B);
    g.fillRect(x - 8, y + TILE_HH - wallH, 16, 26);

    g.fillStyle(0x87CEEB);
    g.fillRect(x + 10, y - wallH + 8, 16, 16);
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(x + 18, y - wallH + 8, 2, 16);
    g.fillRect(x + 10, y - wallH + 16, 16, 2);

    g.fillStyle(0x87CEEB);
    g.beginPath();
    g.moveTo(x - hw + 5, y - wallH + 8);
    g.lineTo(x - hw + 20, y - wallH + 8 + TILE_HH * 0.3);
    g.lineTo(x - hw + 20, y - wallH + 24 + TILE_HH * 0.3);
    g.lineTo(x - hw + 5, y - wallH + 24);
    g.closePath();
    g.fillPath();
  }

  private drawMoxieHQ(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 4);
    const { x, y } = gridToScreen(gx, gy);
    const hw = TILE_HW * 1.3;
    const wallH = 70;

    // Left wall
    g.fillStyle(0xC8D8B8);
    g.beginPath();
    g.moveTo(x - hw, y);
    g.lineTo(x, y + TILE_HH * 1.3);
    g.lineTo(x, y + TILE_HH * 1.3 - wallH);
    g.lineTo(x - hw, y - wallH);
    g.closePath();
    g.fillPath();

    // Front wall
    g.fillStyle(0xD8E8C8);
    g.beginPath();
    g.moveTo(x, y + TILE_HH * 1.3);
    g.lineTo(x + hw, y);
    g.lineTo(x + hw, y - wallH);
    g.lineTo(x, y + TILE_HH * 1.3 - wallH);
    g.closePath();
    g.fillPath();

    // Roof (Moxie green)
    g.fillStyle(COL_MOXIE);
    const roofH = 32;
    g.beginPath();
    g.moveTo(x - hw, y - wallH);
    g.lineTo(x, y + TILE_HH * 1.3 - wallH);
    g.lineTo(x + hw, y - wallH);
    g.lineTo(x, y - wallH - roofH);
    g.closePath();
    g.fillPath();

    // Double doors
    g.fillStyle(0x8B5A2B);
    g.fillRect(x - 12, y + TILE_HH * 1.3 - wallH, 10, 30);
    g.fillRect(x + 2, y + TILE_HH * 1.3 - wallH, 10, 30);

    // Bug logo on front wall
    g.fillStyle(COL_MOXIE, 0.5);
    g.fillCircle(x + hw * 0.4, y - wallH + 22, 12);
    g.lineStyle(2, 0xFFD700);
    g.strokeCircle(x + hw * 0.4, y - wallH + 22, 12);

    // "MOXIE HQ" label
    const hqLabel = this.add.text(x, y - wallH - roofH - 10, 'MOXIE HQ', {
      fontSize: '12px', fontStyle: 'bold',
      color: '#2D6A4F', stroke: '#ffffff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(gx + gy + 4.1);
  }

  private drawPaloVerde(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 2);
    const { x, y } = gridToScreen(gx, gy);

    g.fillStyle(0x9CB850);
    g.fillRoundedRect(x - 5, y - 50, 10, 50, 5);

    g.lineStyle(4, 0x8FAF7E);
    g.lineBetween(x - 2, y - 35, x - 22, y - 58);
    g.lineBetween(x + 2, y - 35, x + 22, y - 58);
    g.lineBetween(x, y - 42, x, y - 66);
    g.lineStyle(3, 0x8FAF7E);
    g.lineBetween(x - 20, y - 55, x - 30, y - 68);
    g.lineBetween(x + 20, y - 55, x + 30, y - 68);

    const puffs = [
      { px: x, py: y - 70, r: 14 },
      { px: x - 24, py: y - 62, r: 12 },
      { px: x + 24, py: y - 62, r: 12 },
      { px: x - 12, py: y - 78, r: 10 },
      { px: x + 12, py: y - 78, r: 10 },
      { px: x - 32, py: y - 70, r: 9 },
      { px: x + 32, py: y - 70, r: 9 },
    ];
    for (const p of puffs) {
      g.fillStyle(COL_SAGE, 0.85);
      g.fillCircle(p.px, p.py, p.r);
      g.fillStyle(0x6B9A60, 0.55);
      g.fillCircle(p.px + 3, p.py + 3, p.r * 0.65);
    }
    for (const p of puffs.slice(0, 4)) {
      g.fillStyle(0xFFD700);
      g.fillCircle(p.px + Phaser.Math.Between(-6, 6), p.py + Phaser.Math.Between(-4, 4), 2.5);
    }
  }

  private drawSaguaro(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 2);
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

  private drawRockPile(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 1);
    const { x, y } = gridToScreen(gx, gy);

    // Shadow
    g.fillStyle(0x000000, 0.1);
    g.fillEllipse(x + 4, y + 3, 36, 14);

    // Large rock
    g.fillStyle(0xB8A080);
    g.fillEllipse(x, y - 4, 26, 16);
    // Medium rock
    g.fillStyle(0xA89070);
    g.fillEllipse(x + 12, y - 2, 18, 12);
    // Small rock
    g.fillStyle(0xC0AA88);
    g.fillEllipse(x - 8, y + 1, 12, 8);

    // Highlight
    g.fillStyle(0xD4C4A8, 0.4);
    g.fillEllipse(x - 3, y - 7, 10, 5);
  }

  private drawBush(gx: number, gy: number) {
    const g = this.add.graphics().setDepth(gx + gy + 1);
    const { x, y } = gridToScreen(gx, gy);

    // Shadow
    g.fillStyle(0x000000, 0.1);
    g.fillEllipse(x + 2, y + 2, 28, 10);

    // Bush puffs
    g.fillStyle(0x6B8E50, 0.8);
    g.fillCircle(x, y - 8, 12);
    g.fillCircle(x + 9, y - 5, 10);
    g.fillCircle(x - 7, y - 4, 9);

    // Darker inner detail
    g.fillStyle(0x4A6E38, 0.4);
    g.fillCircle(x + 2, y - 6, 6);

    // Small flowers occasionally
    if ((gx + gy) % 3 === 0) {
      g.fillStyle(0xFFB6C1);
      g.fillCircle(x - 4, y - 12, 2.5);
      g.fillCircle(x + 6, y - 10, 2);
    }
  }
}
