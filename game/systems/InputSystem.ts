import * as Phaser from "phaser";

export interface InputState {
  isPointerDown: boolean;
  pointerWorldX: number;
  pointerWorldY: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

// A tap is a quick press+release with minimal movement
const TAP_MAX_MS = 250;
const TAP_MAX_MOVE_PX = 20;

export class InputSystem {
  public state: InputState = {
    isPointerDown: false,
    pointerWorldX: 0,
    pointerWorldY: 0,
    up: false,
    down: false,
    left: false,
    right: false,
  };

  // Catch tap — true for exactly one update() frame after a valid tap
  public catchTapFired: boolean = false;
  public catchTapWorldX: number = 0;
  public catchTapWorldY: number = 0;

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  } | null = null;

  private tapStartTime: number = 0;
  private tapStartScreenX: number = 0;
  private tapStartScreenY: number = 0;
  private pendingCatchTap: boolean = false;
  private pendingTapWorldX: number = 0;
  private pendingTapWorldY: number = 0;

  constructor(scene: Phaser.Scene) {
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        up:    scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down:  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left:  scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.state.isPointerDown = true;
      this.state.pointerWorldX = p.worldX;
      this.state.pointerWorldY = p.worldY;
      this.tapStartTime = Date.now();
      this.tapStartScreenX = p.x;
      this.tapStartScreenY = p.y;
    });

    scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        this.state.pointerWorldX = p.worldX;
        this.state.pointerWorldY = p.worldY;
      }
    });

    scene.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      this.state.isPointerDown = false;
      const elapsed = Date.now() - this.tapStartTime;
      const moved = Math.sqrt(
        (p.x - this.tapStartScreenX) ** 2 + (p.y - this.tapStartScreenY) ** 2
      );
      if (elapsed < TAP_MAX_MS && moved < TAP_MAX_MOVE_PX) {
        this.pendingCatchTap = true;
        this.pendingTapWorldX = p.worldX;
        this.pendingTapWorldY = p.worldY;
      }
    });
  }

  update(): void {
    // Flush pending tap into fired flag (true for exactly one frame)
    this.catchTapFired = this.pendingCatchTap;
    if (this.pendingCatchTap) {
      this.catchTapWorldX = this.pendingTapWorldX;
      this.catchTapWorldY = this.pendingTapWorldY;
      this.pendingCatchTap = false;
    }

    if (!this.cursors) return;
    this.state.up    = this.cursors.up.isDown    || (this.wasd?.up.isDown    ?? false);
    this.state.down  = this.cursors.down.isDown  || (this.wasd?.down.isDown  ?? false);
    this.state.left  = this.cursors.left.isDown  || (this.wasd?.left.isDown  ?? false);
    this.state.right = this.cursors.right.isDown || (this.wasd?.right.isDown ?? false);
  }
}
