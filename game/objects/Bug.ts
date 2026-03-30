import Phaser from 'phaser';
import { gridToScreen, GRID_SIZE } from '../constants';
import { BugState } from '../types';

export interface BugTypeData {
  name: string;
  color: number;
  bodyColor: number;
  description: string;
  fact: string;
  rarity: string;
  wanderSpeed: number;
  fleeSpeed: number;
  sizeMult: number;
}

export const BUG_TYPES: BugTypeData[] = [
  {
    name: 'Shades',
    color: 0x8B5E3C,
    bodyColor: 0x5C3317,
    description: 'A cool cockroach who thinks he runs this whole block.',
    fact: 'Cockroaches can hold their breath for 40 minutes!',
    rarity: 'Common',
    wanderSpeed: 0.8,
    fleeSpeed: 2.5,
    sizeMult: 1.0,
  },
  {
    name: 'Dusty',
    color: 0xD4B896,
    bodyColor: 0xB8956A,
    description: 'A bark scorpion who scurries at full speed everywhere.',
    fact: 'Bark scorpions glow blue under UV light!',
    rarity: 'Rare',
    wanderSpeed: 1.8,
    fleeSpeed: 3.5,
    sizeMult: 1.0,
  },
  {
    name: 'DJ Beetle',
    color: 0x1A1A2E,
    bodyColor: 0x16213E,
    description: 'A giant palo verde beetle with iridescent wings.',
    fact: 'Palo verde beetles grow up to 4 inches!',
    rarity: 'Epic',
    wanderSpeed: 1.0,
    fleeSpeed: 2.0,
    sizeMult: 1.3,
  },
  {
    name: 'Neon Moth',
    color: 0xFF69B4,
    bodyColor: 0x39FF14,
    description: 'A neon moth whose wings pulse with vivid color.',
    fact: 'Some moths navigate by moonlight!',
    rarity: 'Uncommon',
    wanderSpeed: 1.4,
    fleeSpeed: 3.0,
    sizeMult: 1.1,
  },
  {
    name: 'Tiny Tim',
    color: 0xCC2200,
    bodyColor: 0xFF3300,
    description: 'A tiny ant who always carries something bigger than himself.',
    fact: 'Harvester ants carry 50x their weight!',
    rarity: 'Common',
    wanderSpeed: 1.0,
    fleeSpeed: 2.2,
    sizeMult: 0.6,
  },
];

const FLEE_RADIUS = 3.2;
const SETTLE_RADIUS = 5.0;
const MIN_GRID = 0.5;
const MAX_GRID = GRID_SIZE - 1.5;
const PROXIMITY_NAME_RADIUS = 2.5;

export class Bug {
  private gfx: Phaser.GameObjects.Graphics;
  nameLabel: Phaser.GameObjects.Text | null = null;

  gx: number;
  gy: number;
  state: BugState = BugState.HIDDEN;
  caught = false;
  hidden = true;

  private boostActive = false;
  private boostTimer = 0;
  private currentAlpha = 0;

  readonly typeData: BugTypeData;
  readonly typeIndex: number;
  readonly id: string;

  private targetGx: number;
  private targetGy: number;
  private wanderTimer = 0;
  private wanderDelay: number;
  private wiggle = 0;

  constructor(private scene: Phaser.Scene, gx: number, gy: number, typeIndex: number) {
    this.gx = gx;
    this.gy = gy;
    this.targetGx = gx;
    this.targetGy = gy;
    this.typeIndex = typeIndex % BUG_TYPES.length;
    this.typeData = BUG_TYPES[this.typeIndex];
    this.id = `bug_${typeIndex}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.wanderDelay = 1000 + Math.random() * 2500;
    this.gfx = scene.add.graphics();
    this.gfx.setAlpha(0);

    this.nameLabel = scene.add.text(0, 0, this.typeData.name, {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(180).setAlpha(0);

    this.redraw();
  }

  /** Make the bug visible — called when player triggers the spawn point. */
  reveal() {
    this.hidden = false;
    // Immediately pick a wander target so bug moves right away
    this.wanderDelay = 300;
    this.wanderTimer = 300;
  }

  /** Temporarily boost flee speed (called on catch miss). */
  boostFlee() {
    this.boostActive = true;
    this.boostTimer = 2500;
    this.state = BugState.FLEE;
  }

  update(delta: number, playerGx: number, playerGy: number) {
    if (this.caught || this.hidden) {
      if (this.nameLabel) this.nameLabel.setAlpha(0);
      return;
    }

    const pdx = playerGx - this.gx;
    const pdy = playerGy - this.gy;
    const playerDist = Math.hypot(pdx, pdy);

    // Check reveal trigger
    if (!this.revealed && playerDist < REVEAL_RADIUS) {
      this.reveal();
    }

    // Hidden bugs don't move or show name
    if (!this.revealed) {
      this.redraw();
      return;
    }

    if (this.boostActive) {
      this.boostTimer -= delta;
      if (this.boostTimer <= 0) {
        this.boostActive = false;
        this.state = BugState.WANDER;
      }
    } else {
      if (playerDist < FLEE_RADIUS) {
        this.state = BugState.FLEE;
      } else if (playerDist > SETTLE_RADIUS) {
        this.state = BugState.WANDER;
      }
    }

    const dt = delta / 1000;
    this.wiggle += delta * 0.005;

    const wanderSpeed = this.typeData.wanderSpeed;
    const fleeSpeed = this.boostActive
      ? this.typeData.fleeSpeed * 1.6
      : this.typeData.fleeSpeed;

    if (this.state === BugState.FLEE) {
      const angle = Math.atan2(pdy, pdx);
      this.gx -= Math.cos(angle) * fleeSpeed * dt;
      this.gy -= Math.sin(angle) * fleeSpeed * dt;
    } else {
      this.wanderTimer += delta;
      if (this.wanderTimer >= this.wanderDelay) {
        this.wanderTimer = 0;
        this.wanderDelay = 1200 + Math.random() * 3000;
        this.targetGx = MIN_GRID + Math.random() * (MAX_GRID - MIN_GRID);
        this.targetGy = MIN_GRID + Math.random() * (MAX_GRID - MIN_GRID);
      }
      const tdx = this.targetGx - this.gx;
      const tdy = this.targetGy - this.gy;
      const tdist = Math.hypot(tdx, tdy);
      if (tdist > 0.1) {
        this.gx += (tdx / tdist) * wanderSpeed * dt;
        this.gy += (tdy / tdist) * wanderSpeed * dt;
      }
    }

    this.gx = Phaser.Math.Clamp(this.gx, MIN_GRID, MAX_GRID);
    this.gy = Phaser.Math.Clamp(this.gy, MIN_GRID, MAX_GRID);

    if (this.nameLabel) {
      const { x, y } = gridToScreen(this.gx, this.gy);
      this.nameLabel.setPosition(x, y - 30);
      this.nameLabel.setAlpha(playerDist < PROXIMITY_NAME_RADIUS ? 1 : 0);
    }

    this.redraw();
  }

  private redraw() {
    if (this.hidden) {
      this.gfx.clear();
      return;
    }

    const { x, y } = gridToScreen(this.gx, this.gy);
    const depth = this.gx + this.gy + 0.3;
    const wo = Math.sin(this.wiggle) * 1.5;
    const s = this.typeData.sizeMult;

    this.gfx.clear();
    this.gfx.setDepth(depth);

    switch (this.typeIndex) {
      case 0: this.drawShades(x, y, wo, s); break;
      case 1: this.drawDusty(x, y, wo, s); break;
      case 2: this.drawDJBeetle(x, y, wo, s); break;
      case 3: this.drawNeonMoth(x, y, wo, s); break;
      case 4: this.drawTinyTim(x, y, wo, s); break;
      default: this.drawShades(x, y, wo, s); break;
    }
  }

  /** Shades — cockroach with sunglasses, struts slowly */
  private drawShades(x: number, y: number, wo: number, s: number) {
    const g = this.gfx;
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(x + wo, y, 18 * s, 6 * s);

    g.fillStyle(0x6B3A1F);
    g.fillEllipse(x + wo, y - 6 * s, 14 * s, 10 * s);

    g.fillStyle(0x8B5E3C);
    g.fillEllipse(x + wo, y - 9 * s, 12 * s, 9 * s);

    g.fillStyle(0x6B3A1F);
    g.fillCircle(x + wo, y - 15 * s, 4.5 * s);

    g.fillStyle(0x111111);
    g.fillRoundedRect(x + wo - 5.5 * s, y - 17.5 * s, 4 * s, 2.5 * s, 1);
    g.fillRoundedRect(x + wo + 1.5 * s, y - 17.5 * s, 4 * s, 2.5 * s, 1);
    g.lineStyle(0.8, 0x444444, 0.9);
    g.lineBetween(x + wo - 1.5 * s, y - 16.5 * s, x + wo + 1.5 * s, y - 16.5 * s);

    g.lineStyle(1, 0x5C3317, 0.9);
    g.lineBetween(x + wo - 1.5 * s, y - 19 * s, x + wo - 6 * s, y - 26 * s);
    g.lineBetween(x + wo + 1.5 * s, y - 19 * s, x + wo + 6 * s, y - 26 * s);

    g.lineStyle(1, 0x5C3317, 0.7);
    for (let i = -1; i <= 1; i++) {
      const ly = y - 8 * s + i * 3 * s;
      g.lineBetween(x + wo - 5 * s, ly, x + wo - 12 * s, ly + 3 * s);
      g.lineBetween(x + wo + 5 * s, ly, x + wo + 12 * s, ly + 3 * s);
    }
  }

  /** Dusty — bark scorpion, tan, pincers, curled tail */
  private drawDusty(x: number, y: number, wo: number, s: number) {
    const g = this.gfx;
    g.fillStyle(0x000000, 0.10);
    g.fillEllipse(x + wo, y, 24 * s, 7 * s);

    g.fillStyle(0xD4B896);
    g.fillEllipse(x + wo, y - 6 * s, 11 * s, 8 * s);
    g.fillStyle(0xC8A882);
    g.fillEllipse(x + wo, y - 11 * s, 9 * s, 7 * s);
    g.fillStyle(0xB8956A);
    g.fillEllipse(x + wo, y - 16 * s, 8 * s, 6 * s);

    const tailSegs = [
      { dx: 6,  dy: -4  },
      { dx: 10, dy: -8  },
      { dx: 12, dy: -13 },
      { dx: 11, dy: -18 },
      { dx: 8,  dy: -21 },
    ];
    let prevTx = x + wo + 5 * s;
    let prevTy = y - 5 * s;
    for (let i = 0; i < tailSegs.length; i++) {
      const tx = x + wo + tailSegs[i].dx * s;
      const ty = y + tailSegs[i].dy * s;
      const r = (3.5 - i * 0.4) * s;
      g.fillStyle(0xC8A882);
      g.fillCircle(tx, ty, r);
      g.lineStyle(1, 0xB8906A, 0.5);
      g.lineBetween(prevTx, prevTy, tx, ty);
      prevTx = tx; prevTy = ty;
    }
    g.fillStyle(0x8B6040);
    g.fillCircle(x + wo + 7 * s, y - 23 * s, 2 * s);

    g.lineStyle(1.5, 0xB8956A);
    g.lineBetween(x + wo - 3 * s, y - 18 * s, x + wo - 9 * s, y - 22 * s);
    g.strokeCircle(x + wo - 10 * s, y - 23 * s, 2.5 * s);
    g.lineBetween(x + wo + 3 * s, y - 18 * s, x + wo + 9 * s, y - 22 * s);
    g.strokeCircle(x + wo + 10 * s, y - 23 * s, 2.5 * s);

    g.lineStyle(1, 0xB8956A, 0.7);
    for (let i = 0; i < 2; i++) {
      const ly = y - 6 * s + i * 4 * s;
      g.lineBetween(x + wo - 4 * s, ly, x + wo - 11 * s, ly + 3 * s);
      g.lineBetween(x + wo + 4 * s, ly, x + wo + 11 * s, ly + 3 * s);
    }
  }

  /** DJ Beetle — big dark palo verde beetle with iridescent shimmer */
  private drawDJBeetle(x: number, y: number, wo: number, s: number) {
    const g = this.gfx;
    const shimmer = Math.sin(this.wiggle * 2) * 0.5 + 0.5;

    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(x + wo, y, 22 * s, 8 * s);

    g.fillStyle(0x1A1A2E);
    g.fillEllipse(x + wo, y - 8 * s, 16 * s, 13 * s);

    const shColor = shimmer > 0.5 ? 0x00CC88 : 0x0088CC;
    g.lineStyle(1.5, shColor, 0.45 + shimmer * 0.35);
    g.strokeEllipse(x + wo - 3 * s, y - 8 * s, 8 * s, 11 * s);
    g.lineStyle(1.5, shColor, 0.35 + shimmer * 0.35);
    g.strokeEllipse(x + wo + 3 * s, y - 8 * s, 8 * s, 11 * s);
    g.lineStyle(1, 0x005566, 0.5 + shimmer * 0.3);
    g.lineBetween(x + wo, y - 2 * s, x + wo, y - 14 * s);

    g.fillStyle(0x16213E);
    g.fillCircle(x + wo, y - 15 * s, 5 * s);

    g.lineStyle(1.5, 0x2A2A50);
    g.lineBetween(x + wo - 2 * s, y - 19 * s, x + wo - 6 * s, y - 23 * s);
    g.lineBetween(x + wo + 2 * s, y - 19 * s, x + wo + 6 * s, y - 23 * s);

    g.lineStyle(1, 0x2A2A50, 0.85);
    g.lineBetween(x + wo - 2 * s, y - 20 * s, x + wo - 18 * s, y - 44 * s);
    g.lineBetween(x + wo + 2 * s, y - 20 * s, x + wo + 18 * s, y - 44 * s);

    g.lineStyle(1, 0x2A2A50, 0.7);
    for (let i = -1; i <= 1; i++) {
      const ly = y - 8 * s + i * 3.5 * s;
      g.lineBetween(x + wo - 7 * s, ly, x + wo - 14 * s, ly + 4 * s);
      g.lineBetween(x + wo + 7 * s, ly, x + wo + 14 * s, ly + 4 * s);
    }
  }

  /** Neon Moth — pulsing neon pink/green wings */
  private drawNeonMoth(x: number, y: number, wo: number, s: number) {
    const g = this.gfx;
    const pulse = Math.sin(this.wiggle * 3);
    const wingColor = pulse > 0 ? 0xFF69B4 : 0x39FF14;
    const wingAlpha = 0.72 + pulse * 0.2;

    g.fillStyle(0x000000, 0.10);
    g.fillEllipse(x + wo, y, 30 * s, 7 * s);

    g.fillStyle(wingColor, wingAlpha);
    g.fillTriangle(
      x + wo - 2 * s, y - 12 * s,
      x + wo - 19 * s, y - 23 * s,
      x + wo - 14 * s, y - 5 * s
    );
    g.fillTriangle(
      x + wo - 2 * s, y - 10 * s,
      x + wo - 16 * s, y - 3 * s,
      x + wo - 9 * s, y + 3 * s
    );
    g.fillTriangle(
      x + wo + 2 * s, y - 12 * s,
      x + wo + 19 * s, y - 23 * s,
      x + wo + 14 * s, y - 5 * s
    );
    g.fillTriangle(
      x + wo + 2 * s, y - 10 * s,
      x + wo + 16 * s, y - 3 * s,
      x + wo + 9 * s, y + 3 * s
    );

    const glowColor = pulse > 0 ? 0xFF1493 : 0x00FF44;
    g.lineStyle(1, glowColor, 0.55);
    g.strokeTriangle(
      x + wo - 2 * s, y - 12 * s,
      x + wo - 19 * s, y - 23 * s,
      x + wo - 14 * s, y - 5 * s
    );
    g.strokeTriangle(
      x + wo + 2 * s, y - 12 * s,
      x + wo + 19 * s, y - 23 * s,
      x + wo + 14 * s, y - 5 * s
    );

    g.fillStyle(0x330033);
    g.fillEllipse(x + wo, y - 10 * s, 5 * s, 14 * s);

    g.lineStyle(1, 0xFF69B4, 0.8);
    g.lineBetween(x + wo - 1 * s, y - 16 * s, x + wo - 7 * s, y - 26 * s);
    g.fillStyle(0xFF69B4);
    g.fillCircle(x + wo - 7 * s, y - 26 * s, 2 * s);
    g.lineStyle(1, 0xFF69B4, 0.8);
    g.lineBetween(x + wo + 1 * s, y - 16 * s, x + wo + 7 * s, y - 26 * s);
    g.fillStyle(0xFF69B4);
    g.fillCircle(x + wo + 7 * s, y - 26 * s, 2 * s);
  }

  /** Tiny Tim — small red ant carrying a tiny object */
  private drawTinyTim(x: number, y: number, wo: number, s: number) {
    const g = this.gfx;
    g.fillStyle(0x000000, 0.10);
    g.fillEllipse(x + wo, y, 10 * s, 4 * s);

    g.fillStyle(0xCC2200);
    g.fillCircle(x + wo, y - 4.5 * s, 4 * s);
    g.fillStyle(0xFF3300);
    g.fillCircle(x + wo, y - 10 * s, 3 * s);
    g.fillStyle(0xCC2200);
    g.fillCircle(x + wo, y - 15 * s, 2.8 * s);

    g.lineStyle(0.8, 0xAA1A00, 0.9);
    g.lineBetween(x + wo - 1 * s, y - 17 * s, x + wo - 4 * s, y - 20 * s);
    g.lineBetween(x + wo - 4 * s, y - 20 * s, x + wo - 2 * s, y - 23 * s);
    g.lineBetween(x + wo + 1 * s, y - 17 * s, x + wo + 4 * s, y - 20 * s);
    g.lineBetween(x + wo + 4 * s, y - 20 * s, x + wo + 2 * s, y - 23 * s);

    g.lineStyle(0.8, 0xAA1A00, 0.7);
    for (let i = -1; i <= 1; i++) {
      const ly = y - 10 * s + i * 2.5 * s;
      g.lineBetween(x + wo - 2 * s, ly, x + wo - 5 * s, ly - 1 * s);
      g.lineBetween(x + wo - 5 * s, ly - 1 * s, x + wo - 8 * s, ly + 2 * s);
      g.lineBetween(x + wo + 2 * s, ly, x + wo + 5 * s, ly - 1 * s);
      g.lineBetween(x + wo + 5 * s, ly - 1 * s, x + wo + 8 * s, ly + 2 * s);
    }

    g.fillStyle(0xFFFFFF, 0.9);
    g.fillCircle(x + wo, y - 9 * s, 2.5 * s);
    g.lineStyle(0.6, 0xCCCCCC, 0.7);
    g.strokeCircle(x + wo, y - 9 * s, 2.5 * s);
  }

  getScreenPos() {
    return gridToScreen(this.gx, this.gy);
  }

  destroy() {
    this.gfx.destroy();
    if (this.nameLabel) {
      this.nameLabel.destroy();
      this.nameLabel = null;
    }
  }
}
