import * as Phaser from "phaser";
import { Bug, BugSpecies, SHADES_SPECIES } from "../objects/Bug";

// GDD: "Walk within ~1.5 tiles of a spawn point and the bug pops out."
const REVEAL_RADIUS = 1.5;

interface SpawnEntry {
  // Grid coords of the hidden spawn point (center of tile)
  cx: number;
  cy: number;
  species: BugSpecies;
  triggered: boolean;
}

// Rock piles in MapRenderer (gx, gy are top-left corners of 1x1 tiles):
//   { gx: 4, gy: 13 }, { gx: 13, gy: 8 }, { gx: 7, gy: 17 },
//   { gx: 16, gy: 5 }, { gx: 3, gy: 6 }, { gx: 17, gy: 13 }
//
// Player starts at grid (10, 10). GDD rule: no spawn within 3 tiles of start.
// Rock pile (4, 13) → center (4.5, 13.5) → dist ≈ 6.7  ✓
const SPAWN_ENTRIES: SpawnEntry[] = [
  { cx: 4.5, cy: 13.5, species: SHADES_SPECIES, triggered: false },
];

export class SpawnSystem {
  private scene: Phaser.Scene;
  private entries: SpawnEntry[];
  private bugs: Bug[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Shallow-copy so each instance has its own triggered flags
    this.entries = SPAWN_ENTRIES.map(e => ({ ...e }));
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.svg("shades", "/sprites/shades.svg", { width: 40, height: 40 });
  }

  update(playerGX: number, playerGY: number, dt: number): void {
    // Check proximity to untriggered spawn points
    for (const entry of this.entries) {
      if (entry.triggered) continue;

      const dx = entry.cx - playerGX;
      const dy = entry.cy - playerGY;
      if (Math.sqrt(dx * dx + dy * dy) < REVEAL_RADIUS) {
        entry.triggered = true;
        const bug = new Bug(this.scene, entry.cx - 0.5, entry.cy - 0.5, entry.species);
        bug.reveal();
        this.bugs.push(bug);
      }
    }

    // Update all active (revealed) bugs
    for (const bug of this.bugs) {
      bug.update(dt, playerGX, playerGY);
    }
  }
}
