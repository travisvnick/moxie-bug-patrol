import * as Phaser from "phaser";
import { gridToScreen, GRID_SIZE } from "../constants";

export type BugState = "hidden" | "wander" | "flee" | "hiding";

export interface BugSpecies {
  key: string;
  wanderSpeed: number;  // grid units per second (relaxed wandering)
  fleeSpeed: number;    // grid units per second (panicked fleeing)
  name: string;
  speciesType: string;  // display label, e.g. "Cockroach"
  funFact: string;
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary";
}

// Shades the Cockroach — skitters away, but re-hides if you don't catch him quick
export const SHADES_SPECIES: BugSpecies = {
  key: "shades",
  wanderSpeed: 1.4,
  fleeSpeed: 3.0,
  name: "Shades",
  speciesType: "Cockroach",
  funFact: "Cockroaches can hold their breath for 40 minutes and survive a week without their head!",
  rarity: "Common",
};

const BOUNDS_MIN = 1.5;
const BOUNDS_MAX = GRID_SIZE - 2.5;

// Flee trigger distances (grid units)
const FLEE_START_DIST = 4.0;
const FLEE_STOP_DIST  = 6.0;

// How long (seconds) the bug stays out before running back to hide
const HIDE_TIMEOUT = 9.0;
// How close to the hide spot before snapping back to hidden
const HIDE_REACH_DIST = 0.5;

export class Bug {
  public gx: number;
  public gy: number;
  public state: BugState = "hidden";
  public species: BugSpecies;
  public caught: boolean = false;
  /** Set true for one frame when bug successfully re-hides. SpawnSystem reads this. */
  public didRehide: boolean = false;

  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Image | null = null;

  // Hide spot — the spawn position it retreats to
  private hideGX: number;
  private hideGY: number;
  private hideTimer: number = 0;

  // Wander AI
  private dirX: number = 0;
  private dirY: number = 0;
  private dirTimer: number = 0;

  // Speed boost after a miss (GDD: 1.6x for 2.5s)
  private speedMultiplier: number = 1.0;
  private speedBoostTimer: number = 0;

  // Flee zigzag
  private fleeJitter: number = 1;
  private fleeJitterTimer: number = 0;

  constructor(
    scene: Phaser.Scene,
    gx: number,
    gy: number,
    species: BugSpecies,
    hideGX: number,
    hideGY: number,
  ) {
    this.scene = scene;
    this.gx = gx;
    this.gy = gy;
    this.species = species;
    this.hideGX = hideGX;
    this.hideGY = hideGY;
  }

  reveal(): void {
    if (this.state !== "hidden") return;
    this.state = "wander";
    this.hideTimer = HIDE_TIMEOUT;
    this.didRehide = false;

    const { x, y } = this.screenPos();
    this.sprite = this.scene.add.image(x, y, this.species.key);
    this.sprite.setOrigin(0.5, 1.0);
    this.sprite.setDepth(this.calcDepth());

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

  /** Mark bug as caught and remove its sprite. */
  catch(): void {
    this.caught = true;
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }

  /** Temporarily boost flee/wander speed after a miss. */
  applySpeedBoost(multiplier: number, duration: number): void {
    this.speedMultiplier = multiplier;
    this.speedBoostTimer = duration;
  }

  update(dt: number, playerGX: number, playerGY: number): void {
    if (this.state === "hidden" || this.caught) return;

    // Decay speed boost
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      if (this.speedBoostTimer <= 0) {
        this.speedMultiplier = 1.0;
        this.speedBoostTimer = 0;
      }
    }

    // Hiding: run back to spawn spot, then disappear
    if (this.state === "hiding") {
      this.moveTowardHideSpot(dt);
      return;
    }

    // Count down the "stay out" timer
    this.hideTimer -= dt;
    if (this.hideTimer <= 0) {
      this.state = "hiding";
      return;
    }

    // Flee/wander state transitions
    const dx = this.gx - playerGX;
    const dy = this.gy - playerGY;
    const dist = Math.sqrt(dx * dx + dy * dy);

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

  // ── Movement ────────────────────────────────────────────────────────────────

  private moveWander(dt: number): void {
    this.dirTimer -= dt;
    if (this.dirTimer <= 0) this.pickWanderDir();
    this.gx += this.dirX * this.species.wanderSpeed * this.speedMultiplier * dt;
    this.gy += this.dirY * this.species.wanderSpeed * this.speedMultiplier * dt;
    this.clampToBounds();
  }

  private moveFlee(dt: number, playerGX: number, playerGY: number): void {
    this.fleeJitterTimer -= dt;
    if (this.fleeJitterTimer <= 0) {
      this.fleeJitter = Math.random() < 0.5 ? 1 : -1;
      this.fleeJitterTimer = 0.35 + Math.random() * 0.55;
    }

    const dx = this.gx - playerGX;
    const dy = this.gy - playerGY;
    const len = Math.sqrt(dx * dx + dy * dy);
    let fx = len > 0 ? dx / len : 0;
    let fy = len > 0 ? dy / len : 0;

    // Perpendicular zigzag
    const perpX = -fy;
    const perpY =  fx;
    fx += perpX * this.fleeJitter * 0.5;
    fy += perpY * this.fleeJitter * 0.5;

    // Wall repulsion
    const WALL_DIST     = 3.5;
    const WALL_STRENGTH = 2.0;
    const leftDist   = this.gx - BOUNDS_MIN;
    const rightDist  = BOUNDS_MAX - this.gx;
    const topDist    = this.gy - BOUNDS_MIN;
    const bottomDist = BOUNDS_MAX - this.gy;

    if (leftDist   < WALL_DIST) fx += WALL_STRENGTH * (1 - leftDist   / WALL_DIST);
    if (rightDist  < WALL_DIST) fx -= WALL_STRENGTH * (1 - rightDist  / WALL_DIST);
    if (topDist    < WALL_DIST) fy += WALL_STRENGTH * (1 - topDist    / WALL_DIST);
    if (bottomDist < WALL_DIST) fy -= WALL_STRENGTH * (1 - bottomDist / WALL_DIST);

    const flen = Math.sqrt(fx * fx + fy * fy);
    if (flen > 0) {
      this.dirX = fx / flen;
      this.dirY = fy / flen;
    }

    this.gx += this.dirX * this.species.fleeSpeed * this.speedMultiplier * dt;
    this.gy += this.dirY * this.species.fleeSpeed * this.speedMultiplier * dt;
    this.clampToBounds();
  }

  /** Run straight back to the hide spot, then vanish. */
  private moveTowardHideSpot(dt: number): void {
    const dx = this.hideGX - this.gx;
    const dy = this.hideGY - this.gy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < HIDE_REACH_DIST) {
      // Reached the hide spot — snap back to hidden
      this.state = "hidden";
      this.didRehide = true;
      if (this.sprite) {
        this.scene.tweens.add({
          targets: this.sprite,
          alpha: 0,
          scaleX: 0,
          scaleY: 0,
          duration: 200,
          ease: "Power2.easeIn",
          onComplete: () => {
            this.sprite?.destroy();
            this.sprite = null;
          },
        });
      }
      return;
    }

    // Move toward hide spot at flee speed (purposeful, no zigzag)
    this.dirX = dx / dist;
    this.dirY = dy / dist;
    this.gx += this.dirX * this.species.fleeSpeed * dt;
    this.gy += this.dirY * this.species.fleeSpeed * dt;

    if (this.sprite) {
      const { x, y } = this.screenPos();
      this.sprite.setPosition(x, y);
      this.sprite.setDepth(this.calcDepth());
    }
  }

  private pickWanderDir(): void {
    const angle = Math.random() * Math.PI * 2;
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.dirTimer = 0.6 + Math.random() * 1.2;
  }

  private clampToBounds(): void {
    this.gx = Math.max(BOUNDS_MIN, Math.min(BOUNDS_MAX, this.gx));
    this.gy = Math.max(BOUNDS_MIN, Math.min(BOUNDS_MAX, this.gy));
  }

  private screenPos(): { x: number; y: number } {
    return gridToScreen(this.gx + 0.5, this.gy + 0.5);
  }

  private calcDepth(): number {
    return 100 + (this.gx + this.gy + 1) * 50;
  }
}
