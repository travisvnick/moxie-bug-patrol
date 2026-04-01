import * as Phaser from "phaser";
import { Bug } from "../objects/Bug";
import { gridToScreen } from "../constants";

// ── Static target circle ───────────────────────────────────────────────────────
// Rarity-colored. Smaller = harder timing window.
const STATIC_RADIUS = 26;

// ── Pulsing circle ────────────────────────────────────────────────────────────
// Oscillates small → large → small. Green when inside the static ring.
const PULSE_MIN    = 5;   // smallest radius
const PULSE_MAX    = 72;  // largest — well outside static ring
const PULSE_PERIOD = 1.4; // seconds per oscillation (faster = harder)

// ── Proximity ─────────────────────────────────────────────────────────────────
// Rings only appear/are visible when player is within VISIBILITY_DIST tiles.
// Must be within CATCH_DIST to actually attempt a catch.
const VISIBILITY_DIST = 3.5;
const CATCH_DIST      = 2.0;

// ── Miss penalty (GDD §2) ─────────────────────────────────────────────────────
const MISS_SPEED_MULT     = 1.6;
const MISS_SPEED_DURATION = 2.5;

// ── Rarity → static ring color ────────────────────────────────────────────────
const RARITY_COLOR: Record<string, number> = {
  Common:    0x44DD44,  // green
  Uncommon:  0xFFCC00,  // yellow
  Rare:      0xFF6600,  // orange
  Legendary: 0xFF44FF,  // magenta
};

interface RingEntry {
  pulseTime: number;
}

export class CatchSystem {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  // One ring entry per active (revealed, uncaught) bug
  private rings: Map<Bug, RingEntry> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(99990);
  }

  /**
   * Called every frame from PaloVerdeLane.
   * Rings appear automatically when a bug is revealed — no activation tap needed.
   * One tap when the pulsing circle is inside the target = catch attempt.
   */
  update(
    dt: number,
    playerGX: number,
    playerGY: number,
    bugs: Bug[],
    catchTapFired: boolean,
  ): void {
    // Register newly revealed bugs
    for (const bug of bugs) {
      if (bug.state !== "hidden" && !bug.caught && !this.rings.has(bug)) {
        this.rings.set(bug, { pulseTime: 0 });
      }
    }
    // Remove caught bugs
    for (const bug of this.rings.keys()) {
      if (bug.caught) this.rings.delete(bug);
    }

    // Advance pulse timers
    for (const [, entry] of this.rings) {
      entry.pulseTime += dt;
    }

    // Redraw all rings — only when player is close enough to see them
    this.graphics.clear();
    for (const [bug, entry] of this.rings) {
      const dx = bug.gx - playerGX;
      const dy = bug.gy - playerGY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= VISIBILITY_DIST) {
        this.drawRing(bug, entry);
      }
    }

    // Catch tap: find the closest revealed bug within catch range and evaluate
    if (catchTapFired && this.rings.size > 0) {
      let closestBug: Bug | null = null;
      let closestDist = Infinity;

      for (const bug of this.rings.keys()) {
        const dx = bug.gx - playerGX;
        const dy = bug.gy - playerGY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CATCH_DIST && dist < closestDist) {
          closestBug = bug;
          closestDist = dist;
        }
      }

      if (closestBug) {
        const entry = this.rings.get(closestBug)!;
        const pulseRadius = this.calcPulseRadius(entry.pulseTime);
        if (pulseRadius <= STATIC_RADIUS) {
          this.successCatch(closestBug);
        } else {
          this.missCatch(closestBug);
        }
      }
    }
  }

  // ── Ring drawing ─────────────────────────────────────────────────────────────

  private drawRing(bug: Bug, entry: RingEntry): void {
    const { x, y } = gridToScreen(bug.gx + 0.5, bug.gy + 0.5);
    const pulseRadius = this.calcPulseRadius(entry.pulseTime);
    const inWindow    = pulseRadius <= STATIC_RADIUS;
    const rarityColor = RARITY_COLOR[bug.species.rarity] ?? RARITY_COLOR.Common;

    // Static target circle — rarity color, always visible
    this.graphics.lineStyle(4, rarityColor, 0.9);
    this.graphics.strokeCircle(x, y, STATIC_RADIUS);

    // Pulsing circle — white outside, green inside the target
    this.graphics.lineStyle(3, inWindow ? 0x00FF44 : 0xFFFFFF, inWindow ? 1.0 : 0.7);
    this.graphics.strokeCircle(x, y, pulseRadius);
  }

  // Sine-wave oscillation: PULSE_MIN → PULSE_MAX → PULSE_MIN over one period
  private calcPulseRadius(pulseTime: number): number {
    const t = (pulseTime % PULSE_PERIOD) / PULSE_PERIOD; // 0..1
    return PULSE_MIN + (PULSE_MAX - PULSE_MIN) * 0.5 * (1 - Math.cos(t * Math.PI * 2));
  }

  // ── Catch outcomes ────────────────────────────────────────────────────────────

  private successCatch(bug: Bug): void {
    const { x, y } = gridToScreen(bug.gx + 0.5, bug.gy + 0.5);
    this.rings.delete(bug);
    bug.catch();
    this.spawnSparkles(x, y);
  }

  private missCatch(bug: Bug): void {
    const { x, y } = gridToScreen(bug.gx + 0.5, bug.gy + 0.5);
    bug.applySpeedBoost(MISS_SPEED_MULT, MISS_SPEED_DURATION);
    this.flashMissRing(x, y);
  }

  // ── Visual effects ────────────────────────────────────────────────────────────

  private spawnSparkles(x: number, y: number): void {
    const colors = [0xFFD700, 0xFF69B4, 0x00FFFF, 0xFFFFFF, 0x0C77D8, 0xFF8C00];
    const count  = 12;

    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2;
      const circle = this.scene.add.arc(x, y, 5, 0, 360, false, colors[i % colors.length]);
      circle.setDepth(99995);
      this.scene.tweens.add({
        targets: circle,
        x: x + Math.cos(angle) * 72,
        y: y + Math.sin(angle) * 72,
        alpha: 0,
        duration: 520,
        ease: "Power2.easeOut",
        onComplete: () => circle.destroy(),
      });
    }

    // Central white burst
    const burst = this.scene.add.arc(x, y, 20, 0, 360, false, 0xFFFFFF, 0.85);
    burst.setDepth(99994);
    this.scene.tweens.add({
      targets: burst,
      scaleX: 2.8,
      scaleY: 2.8,
      alpha: 0,
      duration: 360,
      ease: "Power2.easeOut",
      onComplete: () => burst.destroy(),
    });
  }

  /** Brief red flash of the static circle so the player sees they missed. */
  private flashMissRing(x: number, y: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(99991);
    g.lineStyle(4, 0xFF3333, 1.0);
    g.strokeCircle(x, y, STATIC_RADIUS);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 340,
      onComplete: () => g.destroy(),
    });
  }
}
