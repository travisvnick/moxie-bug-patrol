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
      // Fire catch attempt immediately on press — the ring is evaluated at the
      // exact frame the player taps, so what they see is what gets judged.
      this.pendingCatchTap = true;
      this.pendingTapWorldX = p.worldX;
      this.pendingTapWorldY = p.worldY;
    });

    scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        this.state.pointerWorldX = p.worldX;
        this.state.pointerWorldY = p.worldY;
      }
    });

    scene.input.on("pointerup", () => {
      this.state.isPointerDown = false;
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
