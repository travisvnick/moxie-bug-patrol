import * as Phaser from "phaser";
import { Bug, BugSpecies, SHADES_SPECIES } from "../objects/Bug";

const REVEAL_RADIUS = 1.5;

interface SpawnEntry {
  cx: number;       // grid center X of spawn point
  cy: number;       // grid center Y of spawn point
  species: BugSpecies;
  triggered: boolean;
  activeBug: Bug | null;
}

const SPAWN_ENTRIES: SpawnEntry[] = [
  { cx: 4.5, cy: 13.5, species: SHADES_SPECIES, triggered: false, activeBug: null },
];

export class SpawnSystem {
  private scene: Phaser.Scene;
  private entries: SpawnEntry[];
  private bugs: Bug[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.entries = SPAWN_ENTRIES.map(e => ({ ...e }));
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.svg("shades", "/sprites/shades.svg", { width: 40, height: 40 });
  }

  getBugs(): Bug[] {
    return this.bugs;
  }

  update(playerGX: number, playerGY: number, dt: number): void {
    // Check for bugs that re-hid — reset their entry so they can be revealed again
    for (const entry of this.entries) {
      if (entry.activeBug?.didRehide) {
        const bug = entry.activeBug;
        bug.didRehide = false;
        this.bugs = this.bugs.filter(b => b !== bug);
        entry.activeBug = null;
        entry.triggered = false;
      }
    }

    // Proximity check — reveal untriggered spawn points
    for (const entry of this.entries) {
      if (entry.triggered) continue;

      const dx = entry.cx - playerGX;
      const dy = entry.cy - playerGY;
      if (Math.sqrt(dx * dx + dy * dy) < REVEAL_RADIUS) {
        entry.triggered = true;
        // Bug starts at spawn center; hide spot is same position so it runs home
        const bug = new Bug(
          this.scene,
          entry.cx - 0.5,
          entry.cy - 0.5,
          entry.species,
          entry.cx - 0.5,  // hideGX
          entry.cy - 0.5,  // hideGY
        );
        bug.reveal();
        entry.activeBug = bug;
        this.bugs.push(bug);
      }
    }

    // Update all active bugs
    for (const bug of this.bugs) {
      bug.update(dt, playerGX, playerGY);
    }
  }
}
