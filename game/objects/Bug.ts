import Phaser from 'phaser';
import { gridToScreen, GRID_SIZE } from '../constants';
import { BugState } from '../types';

export interface BugTypeData {
  name: string;
  color: number;
  bodyColor: number;
  description: string;
}

export const BUG_TYPES: BugTypeData[] = [
  { name: 'Desert Beetle',    color: 0x8B4513, bodyColor: 0x5C2A00, description: 'A shiny brown beetle found under rocks.' },
  { name: 'Palo Verde Moth',  color: 0xD2B48C, bodyColor: 0xA0785A, description: 'A pale moth that hides in tree bark.' },
  { name: 'Banded Firefly',   color: 0xFFEB3B, bodyColor: 0xE65100, description: 'Glows orange at dusk in summer.' },
  { name: 'Striped Scorpion', color: 0xFFD700, bodyColor: 0xB8860B, description: 'A tiny, harmless bark scorpion.' },
  { name: 'Cactus Beetle',    color: 0x2D6A4F, bodyColor: 0x1B4332, description: 'Lives inside old saguaro cavities.' },
];

const FLEE_RADIUS = 3.2;    // grid units
const SETTLE_RADIUS = 5.0;
const WANDER_SPEED = 1.2;   // grid units/sec
const FLEE_SPEED = 2.8;
const MIN_GRID = 0.5;
const MAX_GRID = GRID_SIZE - 1.5;

export class Bug {
  private gfx: Phaser.GameObjects.Graphics;

  gx: number;
  gy: number;
  state: BugState = BugState.WANDER;
  caught = false;

  readonly typeData: BugTypeData;
  readonly id: string;

  private targetGx: number;
  private targetGy: number;
  private wanderTimer = 0;
  private wanderDelay: number;
  // small oscillation for lifelike movement
  private wiggle = 0;

  constructor(private scene: Phaser.Scene, gx: number, gy: number, typeIndex: number) {
    this.gx = gx;
    this.gy = gy;
    this.targetGx = gx;
    this.targetGy = gy;
    this.typeData = BUG_TYPES[typeIndex % BUG_TYPES.length];
    this.id = `bug_${typeIndex}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.wanderDelay = 1000 + Math.random() * 2500;
    this.gfx = scene.add.graphics();
    this.redraw();
  }

  update(delta: number, playerGx: number, playerGy: number) {
    if (this.caught) return;

    const pdx = playerGx - this.gx;
    const pdy = playerGy - this.gy;
    const playerDist = Math.hypot(pdx, pdy);

    if (playerDist < FLEE_RADIUS) {
      this.state = BugState.FLEE;
    } else if (playerDist > SETTLE_RADIUS) {
      this.state = BugState.WANDER;
    }

    const dt = delta / 1000;
    this.wiggle += delta * 0.005;

    if (this.state === BugState.FLEE) {
      const angle = Math.atan2(pdy, pdx);
      const speed = FLEE_SPEED * dt;
      this.gx -= Math.cos(angle) * speed;
      this.gy -= Math.sin(angle) * speed;
    } else {
      // Wander: pick a new target periodically then walk toward it
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
        const speed = WANDER_SPEED * dt;
        this.gx += (tdx / tdist) * speed;
        this.gy += (tdy / tdist) * speed;
      }
    }

    this.gx = Phaser.Math.Clamp(this.gx, MIN_GRID, MAX_GRID);
    this.gy = Phaser.Math.Clamp(this.gy, MIN_GRID, MAX_GRID);

    this.redraw();
  }

  private redraw() {
    const { x, y } = gridToScreen(this.gx, this.gy);
    const depth = this.gx + this.gy + 0.3;
    const wo = Math.sin(this.wiggle) * 1.5; // wiggle offset

    this.gfx.clear();
    this.gfx.setDepth(depth);

    // Shadow
    this.gfx.fillStyle(0x000000, 0.12);
    this.gfx.fillEllipse(x + wo, y, 14, 5);

    // Body (abdomen)
    this.gfx.fillStyle(this.typeData.bodyColor);
    this.gfx.fillEllipse(x + wo, y - 7, 10, 8);

    // Shell / wings
    this.gfx.fillStyle(this.typeData.color);
    this.gfx.fillEllipse(x + wo, y - 8, 9, 7);

    // Head
    this.gfx.fillStyle(this.typeData.bodyColor);
    this.gfx.fillCircle(x + wo, y - 13, 3.5);

    // Antennae
    this.gfx.lineStyle(1, this.typeData.bodyColor, 0.9);
    this.gfx.lineBetween(x + wo - 1, y - 15, x + wo - 5, y - 21);
    this.gfx.lineBetween(x + wo + 1, y - 15, x + wo + 5, y - 21);

    // Legs (3 pairs)
    this.gfx.lineStyle(1, this.typeData.bodyColor, 0.7);
    for (let i = -1; i <= 1; i++) {
      const ly = y - 8 + i * 2.5;
      this.gfx.lineBetween(x + wo - 4, ly, x + wo - 9, ly + 2);
      this.gfx.lineBetween(x + wo + 4, ly, x + wo + 9, ly + 2);
    }
  }

  getScreenPos() {
    return gridToScreen(this.gx, this.gy);
  }

  destroy() {
    this.gfx.destroy();
  }
}
