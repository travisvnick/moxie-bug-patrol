import * as Phaser from "phaser";
import {
  BG_COLOR, GRID_SIZE, gridToScreen,
  PLAYER_START_X, PLAYER_START_Y,
} from "../constants";
import { MapRenderer }    from "../map/MapRenderer";
import { BorderRenderer } from "../map/BorderRenderer";
import { ExitZones }      from "../map/ExitZones";
import { InputSystem }    from "../systems/InputSystem";
import { CameraSystem }  from "../systems/CameraSystem";
import { SpawnSystem }   from "../systems/SpawnSystem";
import { CatchSystem }   from "../systems/CatchSystem";
import { resetCollisionGrid, resolvePlayerMove } from "../systems/CollisionSystem";
import eventBus from "../eventBus";

// Player moves at 160 px/s in screen space — constant visual speed in any direction.
const PLAYER_SCREEN_SPEED = 160;

// Exit gaps defined in BorderRenderer:
//   North: gy === 0, gx 8-12
//   West:  gx === 0, gy 8-12
//   East:  gx === 19, gy 8-12

export default class PaloVerdeLane extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private cameraSystem!: CameraSystem;
  private spawnSystem!: SpawnSystem;
  private catchSystem!: CatchSystem;
  private exitZones!: ExitZones;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerGX: number = PLAYER_START_X;
  private playerGY: number = PLAYER_START_Y;

  // Named handlers so we can remove them on shutdown
  private readonly onBugCaught       = () => { this.scene.pause(); };
  private readonly onCatchDismissed  = () => { this.scene.resume(); };
  private readonly onResetProgress   = () => { this.scene.restart(); };

  constructor() {
    super({ key: "PaloVerdeLane" });
  }

  preload(): void {
    MapRenderer.preload(this);
    BorderRenderer.preload(this);
    SpawnSystem.preload(this);
    this.load.svg("player", "/sprites/player.svg", { width: 48, height: 88 });
  }

  create(): void {
    // Reset player position — scene.restart() reuses the same instance,
    // so class field initializers don't re-run. Must reset explicitly.
    this.playerGX = PLAYER_START_X;
    this.playerGY = PLAYER_START_Y;

    this.cameras.main.setBackgroundColor(BG_COLOR);

    // Reset collision grid before placing objects (border + map register tiles)
    resetCollisionGrid();
    new BorderRenderer(this).create();
    new MapRenderer(this).create();

    // Player sprite — same placement convention as MapRenderer.placeSprite (1×1 footprint):
    // position = gridToScreen(gx+1, gy+1), origin = (0.5, 1) so feet land at tile front vertex.
    const { x, y } = gridToScreen(this.playerGX + 1, this.playerGY + 1);
    this.playerSprite = this.add.image(x, y, "player");
    this.playerSprite.setOrigin(0.5, 1.0);
    this.playerSprite.setDepth(this.playerDepth());

    this.inputSystem  = new InputSystem(this);
    this.cameraSystem = new CameraSystem(this);
    this.spawnSystem  = new SpawnSystem(this);
    this.catchSystem  = new CatchSystem(this);
    this.exitZones    = new ExitZones(this);
    this.exitZones.create();

    // Snap camera to player on creation
    this.cameraSystem.update(this.playerGX, this.playerGY);

    // Pause scene when catch card is showing; resume on dismiss
    eventBus.on("bugCaught", this.onBugCaught);
    eventBus.on("catchCardDismissed", this.onCatchDismissed);
    eventBus.on("resetProgress", this.onResetProgress);
  }

  shutdown(): void {
    eventBus.off("bugCaught", this.onBugCaught);
    eventBus.off("catchCardDismissed", this.onCatchDismissed);
    eventBus.off("resetProgress", this.onResetProgress);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.inputSystem.update();

    // Evaluate catch BEFORE any movement this frame.
    // Both player and bug positions are still at last-frame values,
    // matching exactly what was rendered — no positional drift before the check.
    this.catchSystem.update(
      dt,
      this.playerGX,
      this.playerGY,
      this.spawnSystem.getBugs(),
      this.inputSystem.catchTapFired,
    );

    this.movePlayer(delta);
    this.spawnSystem.update(this.playerGX, this.playerGY, dt);
    this.cameraSystem.update(this.playerGX, this.playerGY);

    // Check exit zones — reload same scene for now (placeholder for multi-zone nav)
    if (this.exitZones.update(this.playerGX, this.playerGY)) {
      this.scene.restart();
    }
  }

  // ── Player movement ───────────────────────────────────────────────────────────

  private movePlayer(delta: number): void {
    const dt = delta / 1000;
    const { state } = this.inputSystem;

    // Resolve screen-space direction vector (normalized)
    let sdx = 0;
    let sdy = 0;

    if (state.isPointerDown) {
      // Walk continuously toward the held pointer position
      const { x: fx, y: fy } = gridToScreen(this.playerGX + 1, this.playerGY + 1);
      const dx = state.pointerWorldX - fx;
      const dy = state.pointerWorldY - fy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 8) { sdx = dx / len; sdy = dy / len; }

    } else {
      // WASD / arrow keys each map to a cardinal screen direction
      if (state.left)  sdx -= 1;
      if (state.right) sdx += 1;
      if (state.up)    sdy -= 1;
      if (state.down)  sdy += 1;
      const len = Math.sqrt(sdx * sdx + sdy * sdy);
      if (len > 0) { sdx /= len; sdy /= len; }
    }

    if (sdx === 0 && sdy === 0) return;

    // Scale to screen speed, then convert to grid velocity via inverse Jacobian of gridToScreen.
    // gridToScreen: sx=(gx-gy)*32, sy=(gx+gy)*16  →  J⁻¹ = 1/1024 * [16 32; -16 32]
    const svx = sdx * PLAYER_SCREEN_SPEED;
    const svy = sdy * PLAYER_SCREEN_SPEED;
    const rawGX = this.playerGX + (svx / 64 + svy / 32) * dt;
    const rawGY = this.playerGY + (-svx / 64 + svy / 32) * dt;

    // Check if player is in an exit gap — if so, allow free movement
    // (exit gap border tiles are not registered as blocked).
    // Beyond the grid edge, skip collision so the exit zone transition works.
    const inExitArea =
      rawGX < 0 || rawGX >= GRID_SIZE - 1 || rawGY < 0;

    if (inExitArea) {
      // In exit approach area — just clamp to sane outer bounds
      this.playerGX = Math.max(-3, Math.min(GRID_SIZE + 2, rawGX));
      this.playerGY = Math.max(-3, Math.min(GRID_SIZE + 2, rawGY));
    } else {
      // Normal movement — resolve with collision + wall sliding
      const resolved = resolvePlayerMove(
        this.playerGX, this.playerGY, rawGX, rawGY,
      );
      this.playerGX = resolved.gx;
      this.playerGY = resolved.gy;
    }

    // Update sprite position + depth sort
    const { x, y } = gridToScreen(this.playerGX + 1, this.playerGY + 1);
    this.playerSprite.setPosition(x, y);
    this.playerSprite.setDepth(this.playerDepth());
  }

  private playerDepth(): number {
    // Match MapRenderer.placeSprite depth formula (1×1 footprint)
    return 100 + (this.playerGX + 1 + this.playerGY + 1) * 50 + this.playerGX + 1;
  }
}
