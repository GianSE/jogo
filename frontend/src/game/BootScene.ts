import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add
      .text(cx, cy - 32, "Casinha Virtual 🏠", {
        fontSize: "18px",
        color: "#e8a0bf",
        fontFamily: "sans-serif",
      })
      .setOrigin(0.5);

    this.add.rectangle(cx, cy + 10, 262, 14, 0x2a2438).setStrokeStyle(1, 0x5a4a6a);
    const bar = this.add.rectangle(cx - 128, cy + 10, 0, 10, 0xe8a0bf).setOrigin(0, 0.5);
    this.load.on("progress", (v: number) => bar.setSize(v * 256, 10));
    this.load.on("loaderror", (f: Phaser.Loader.File) =>
      console.warn(`[Boot] missing asset: ${f.url}`)
    );

    // Character — Sprout Lands, 192×192, 48×48 per frame, 4×4 grid
    // Row 0=Down  Row 1=Up  Row 2=Left  Row 3=Right
    this.load.spritesheet("player", "assets/characters/player.png", {
      frameWidth: 48,
      frameHeight: 48,
    });

    // Island tilemap (Tiled JSON — regenerate with: npm run export-map)
    this.load.tilemapTiledJSON("island", "assets/maps/island.json");

    // Terrain & props (Cute Fantasy)
    this.load.image("grass",    "assets/tiles/grass.png");     // 16×16 tile
    this.load.image("oak_tree", "assets/tiles/oak_tree.png");  // 64×80
    this.load.image("house",    "assets/tiles/house.png");     // 96×128
    // Fence — 64×64 total, 2×2 grid, 32×32 per frame
    this.load.spritesheet("fence", "assets/tiles/fences.png", {
      frameWidth: 32,
      frameHeight: 32,
    });

    // Animals (Cute Fantasy) — 64×64, 32×32 per frame, 2×2 grid = 4 frames
    for (const a of ["chicken", "pig", "sheep", "cow"]) {
      this.load.spritesheet(a, `assets/animals/${a}.png`, {
        frameWidth: 32,
        frameHeight: 32,
      });
    }
  }

  create(): void {
    // Player walk / idle animations — 4 frames per direction
    const DIRS: [string, number][] = [
      ["down", 0], ["up", 4], ["left", 8], ["right", 12],
    ];
    for (const [dir, start] of DIRS) {
      this.anims.create({
        key: `walk-${dir}`,
        frames: this.anims.generateFrameNumbers("player", { start, end: start + 3 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: `idle-${dir}`,
        frames: [{ key: "player", frame: start }],
        frameRate: 1,
        repeat: -1,
      });
    }

    // Animal animations (4-frame walk loop, frame 0 idle)
    for (const type of ["chicken", "pig", "sheep", "cow"]) {
      this.anims.create({
        key: `${type}-walk`,
        frames: this.anims.generateFrameNumbers(type, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
      this.anims.create({
        key: `${type}-idle`,
        frames: [{ key: type, frame: 0 }],
        frameRate: 1,
        repeat: -1,
      });
    }

    this.scene.start("Island");
  }
}
