import * as Phaser from "phaser";
import {
  Bug, BugSpecies,
  SHADES_SPECIES,
  DUSTY_SPECIES,
  DJ_BEETLE_SPECIES,
  NEON_MOTH_SPECIES,
  TINY_TIM_SPECIES,
} from "../objects/Bug";

const REVEAL_RADIUS = 1.5;

interface SpawnEntry {
  cx: number;       // grid center X of spawn point
  cy: number;       // grid center Y of spawn point
  species: BugSpecies;
  triggered: boolean;
  activeBug: Bug | null;
}

// All spawn points are 3+ grid tiles from player start (10, 10).
// Placed near thematic objects: rocks, cacti, trees, bushes, houses.
const SPAWN_ENTRIES: SpawnEntry[] = [
  // Shades — near rock pile at (4, 13)
  { cx: 4.5,  cy: 13.5, species: SHADES_SPECIES,    triggered: false, activeBug: null },
  // Dusty — near rock pile at (16, 5)
  { cx: 16.5, cy: 5.5,  species: DUSTY_SPECIES,     triggered: false, activeBug: null },
  // DJ Beetle — near palo verde tree at (13, 4)
  { cx: 13.5, cy: 4.5,  species: DJ_BEETLE_SPECIES,  triggered: false, activeBug: null },
  // Neon Moth — near house at (15, 13), drawn to the porch light
  { cx: 17.5, cy: 13.5, species: NEON_MOTH_SPECIES,  triggered: false, activeBug: null },
  // Tiny Tim — near bush at (2, 10), hauling crumbs from the yard
  { cx: 2.5,  cy: 9.5,  species: TINY_TIM_SPECIES,   triggered: false, activeBug: null },
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
    scene.load.svg("shades",     "/sprites/shades.svg",     { width: 40, height: 40 });
    scene.load.svg("dusty",      "/sprites/dusty.svg",      { width: 40, height: 40 });
    scene.load.svg("dj-beetle",  "/sprites/dj-beetle.svg",  { width: 48, height: 48 });
    scene.load.svg("neon-moth",  "/sprites/neon-moth.svg",  { width: 44, height: 44 });
    scene.load.svg("tiny-tim",   "/sprites/tiny-tim.svg",   { width: 36, height: 36 });
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
