import * as Phaser from "phaser";
import { Bug } from "../objects/Bug";
import { gridToScreen } from "../constants";

// ── Ring dimensions (screen pixels) ───────────────────────────────────────────
// The ring shrinks from MAX → MIN over PERIOD seconds, then resets.
// When radius ≤ GREEN_THRESHOLD the ring turns green (= catch window).
const RING_MAX_RADIUS  = 80;
const RING_MIN_RADIUS  = 14;
const RING_PERIOD      = 1.6;  // seconds per pulse cycle
const GREEN_THRESHOLD  = 38;   // radius at or below = green zone (~35% of cycle)
const RING_LINE_WIDTH  = 5;

// ── Distance thresholds (grid units) ──────────────────────────────────────────
// GDD: "within ~2 grid tiles" to activate; ring cancels if bug >3 tiles from player.
const ACTIVATE_DIST = 2.0;
const CANCEL_DIST   = 3.0;

// ── Miss speed boost (GDD §2 Catching) ────────────────────────────────────────
const MISS_SPEED_MULT     = 1.6;
const MISS_SPEED_DURATION = 2.5;  // seconds

type CatchState = "idle" | "active";

export class CatchSystem {
  private scene: Phaser.Scene;
  private state: CatchState = "idle";
  private targetBug: Bug | null = null;
  private ringGraphics: Phaser.GameObjects.Graphics;
  private ringTime: number = 0;
  private ringRadius: number = RING_MAX_RADIUS;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ringGraphics = scene.add.graphics();
    this.ringGraphics.setDepth(99990);
  }

  /**
   * Called every frame from PaloVerdeLane.
   * catchTapFired is true for exactly one frame (set by InputSystem).
   */
  update(
    dt: number,
    playerGX: number,
    playerGY: number,
    bugs: Bug[],
    catchTapFired: boolean,
  ): void {
    if (this.state === "idle") {
      if (catchTapFired) {
        this.tryActivate(playerGX, playerGY, bugs);
      }
    } else {
      this.updateActive(dt, playerGX, playerGY, catchTapFired);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private tryActivate(playerGX: number, playerGY: number, bugs: Bug[]): void {
    let closestBug: Bug | null = null;
    let closestDist = Infinity;

    for (const bug of bugs) {
      if (bug.state === "hidden" || bug.caught) continue;
      const dx = bug.gx - playerGX;
      const dy = bug.gy - playerGY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ACTIVATE_DIST && dist < closestDist) {
        closestBug = bug;
        closestDist = dist;
      }
    }

    if (!closestBug) return;

    this.targetBug = closestBug;
    this.state = "active";
    this.ringTime = 0;
    this.ringRadius = RING_MAX_RADIUS;
  }

  private updateActive(
    dt: number,
    playerGX: number,
    playerGY: number,
    catchTapFired: boolean,
  ): void {
    const bug = this.targetBug!;

    // Cancel: bug already caught
    if (bug.caught) { this.cancel(); return; }

    // Cancel: bug too far from player (GDD: >3 tiles)
    const dx = bug.gx - playerGX;
    const dy = bug.gy - playerGY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > CANCEL_DIST) { this.cancel(); return; }

    // Advance ring pulse: linear shrink from MAX → MIN, then reset
    this.ringTime += dt;
    const t = (this.ringTime % RING_PERIOD) / RING_PERIOD;  // 0 → 1 repeating
    this.ringRadius = RING_MAX_RADIUS - (RING_MAX_RADIUS - RING_MIN_RADIUS) * t;

    const isGreen = this.ringRadius <= GREEN_THRESHOLD;

    // Draw ring centered on the bug's world position
    const bugScreen = gridToScreen(bug.gx + 0.5, bug.gy + 0.5);
    this.ringGraphics.clear();
    this.ringGraphics.lineStyle(
      RING_LINE_WIDTH,
      isGreen ? 0x00FF44 : 0xFFFFFF,
      isGreen ? 1.0 : 0.85,
    );
    this.ringGraphics.strokeCircle(bugScreen.x, bugScreen.y, this.ringRadius);

    // Second tap = catch attempt
    if (catchTapFired) {
      if (isGreen) {
        this.successCatch(bug);
      } else {
        this.missCatch(bug);
      }
    }
  }

  private successCatch(bug: Bug): void {
    this.ringGraphics.clear();
    this.state = "idle";
    this.targetBug = null;
    bug.catch();
    this.spawnSparkles(bug.gx, bug.gy);
  }

  private missCatch(bug: Bug): void {
    const savedRadius = this.ringRadius;
    const bugPos = gridToScreen(bug.gx + 0.5, bug.gy + 0.5);
    this.ringGraphics.clear();
    this.state = "idle";
    this.targetBug = null;
    bug.applySpeedBoost(MISS_SPEED_MULT, MISS_SPEED_DURATION);
    this.flashMissRing(bugPos.x, bugPos.y, savedRadius);
  }

  private cancel(): void {
    this.ringGraphics.clear();
    this.state = "idle";
    this.targetBug = null;
  }

  // ── Visual effects ───────────────────────────────────────────────────────────

  /** Sparkle burst of colored circles radiating outward on a successful catch. */
  private spawnSparkles(gx: number, gy: number): void {
    const { x, y } = gridToScreen(gx + 0.5, gy + 0.5);
    const colors = [0xFFD700, 0xFF69B4, 0x00FFFF, 0xFFFFFF, 0x0C77D8, 0xFF8C00];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const circle = this.scene.add.arc(x, y, 5, 0, 360, false, colors[i % colors.length]);
      circle.setDepth(99995);
      this.scene.tweens.add({
        targets: circle,
        x: x + Math.cos(angle) * 70,
        y: y + Math.sin(angle) * 70,
        alpha: 0,
        duration: 520,
        ease: "Power2.easeOut",
        onComplete: () => circle.destroy(),
      });
    }

    // Central white burst
    const burst = this.scene.add.arc(x, y, 18, 0, 360, false, 0xFFFFFF, 0.8);
    burst.setDepth(99994);
    this.scene.tweens.add({
      targets: burst,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 350,
      ease: "Power2.easeOut",
      onComplete: () => burst.destroy(),
    });
  }

  /** Brief red ring flash on a miss so the player gets clear feedback. */
  private flashMissRing(x: number, y: number, radius: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(99991);
    g.lineStyle(RING_LINE_WIDTH, 0xFF3333, 1.0);
    g.strokeCircle(x, y, radius);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 320,
      onComplete: () => g.destroy(),
    });
  }
}
