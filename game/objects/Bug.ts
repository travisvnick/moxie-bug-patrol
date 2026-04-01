import * as Phaser from "phaser";
import { gridToScreen, GRID_SIZE } from "../constants";

export type BugState = "hidden" | "wander" | "flee";

export interface BugSpecies {
  key: string;
  wanderSpeed: number;  // grid units per second (relaxed wandering)
  fleeSpeed: number;    // grid units per second (panicked fleeing)
  name: string;
  funFact: string;
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary";
}

// Shades the Cockroach — slow and cool until cornered
export const SHADES_SPECIES: BugSpecies = {
  key: "shades",
  wanderSpeed: 0.9,
  fleeSpeed: 2.2,
  name: "Shades",
  funFact: "Cockroaches can hold their breath for 40 minutes and survive a week without their head!",
  rarity: "Common",
};

const BOUNDS_MIN = 1.5;
const BOUNDS_MAX = GRID_SIZE - 2.5;

// Distance thresholds (grid units)
const FLEE_START_DIST = 3.0;
const FLEE_STOP_DIST  = 4.2;

export class Bug {
  public gx: number;
  public gy: number;
  public state: BugState = "hidden";
  public species: BugSpecies;

  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Image | null = null;

  // Wander AI
  private dirX: number = 0;
  private dirY: number = 0;
  private dirTimer: number = 0;

  constructor(scene: Phaser.Scene, gx: number, gy: number, species: BugSpecies) {
    this.scene = scene;
    this.gx = gx;
    this.gy = gy;
    this.species = species;
  }

  reveal(): void {
    if (this.state !== "hidden") return;
    this.state = "wander";

    // Create sprite
    const { x, y } = this.screenPos();
    this.sprite = this.scene.add.image(x, y, this.species.key);
    this.sprite.setOrigin(0.5, 1.0);
    this.sprite.setDepth(this.calcDepth());

    // Pop-in scale animation
    this.sprite.setScale(0);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: "Back.easeOut",
    });

    // Gold "!" floats upward and fades
    const bang = this.scene.add.text(x, y - 20, "!", {
      fontSize: "32px",
      color: "#FFD700",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4,
    });
    bang.setOrigin(0.5, 1.0);
    bang.setDepth(99999);

    this.scene.tweens.add({
      targets: bang,
      y: y - 72,
      alpha: 0,
      duration: 900,
      ease: "Power2.easeOut",
      onComplete: () => bang.destroy(),
    });

    this.pickWanderDir();
  }

  update(dt: number, playerGX: number, playerGY: number): void {
    if (this.state === "hidden") return;

    const dx = this.gx - playerGX;
    const dy = this.gy - playerGY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // State transitions
    if (dist < FLEE_START_DIST) {
      this.state = "flee";
    } else if (this.state === "flee" && dist > FLEE_STOP_DIST) {
      this.state = "wander";
    }

    if (this.state === "flee") {
      this.moveFlee(dt, playerGX, playerGY);
    } else {
      this.moveWander(dt);
    }

    // Sync sprite
    if (this.sprite) {
      const { x, y } = this.screenPos();
      this.sprite.setPosition(x, y);
      this.sprite.setDepth(this.calcDepth());
    }
  }

  private moveWander(dt: number): void {
    this.dirTimer -= dt;
    if (this.dirTimer <= 0) this.pickWanderDir();

    this.gx += this.dirX * this.species.wanderSpeed * dt;
    this.gy += this.dirY * this.species.wanderSpeed * dt;
    this.clampToBounds();
  }

  private moveFlee(dt: number, playerGX: number, playerGY: number): void {
    const dx = this.gx - playerGX;
    const dy = this.gy - playerGY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      this.dirX = dx / len;
      this.dirY = dy / len;
      this.gx += this.dirX * this.species.fleeSpeed * dt;
      this.gy += this.dirY * this.species.fleeSpeed * dt;
    }
    this.clampToBounds();
  }

  private pickWanderDir(): void {
    const angle = Math.random() * Math.PI * 2;
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.dirTimer = 1.5 + Math.random() * 2.0;  // 1.5–3.5 s per direction
  }

  private clampToBounds(): void {
    this.gx = Math.max(BOUNDS_MIN, Math.min(BOUNDS_MAX, this.gx));
    this.gy = Math.max(BOUNDS_MIN, Math.min(BOUNDS_MAX, this.gy));
  }

  private screenPos(): { x: number; y: number } {
    // Bug occupies a 1x1 tile; use center of tile
    return gridToScreen(this.gx + 0.5, this.gy + 0.5);
  }

  private calcDepth(): number {
    return 100 + (this.gx + this.gy + 1) * 50;
  }
}
