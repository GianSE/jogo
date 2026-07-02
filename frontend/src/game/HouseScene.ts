import Phaser from "phaser";
import { getFurnitures } from "../net/furnitureBuffer";
import { useHouseStore } from "../store/useHouseStore";
import { sendHouseEnter } from "../net/outgoing";

const COLS = 10;
const ROWS = 8;
const CELL = 48;
const HOUSE_WIDTH = COLS * CELL;  // 480
const HOUSE_HEIGHT = ROWS * CELL; // 384

const FURNITURE_COLORS: Record<string, number> = {
  furn_bed:   0xe8a0bf,
  furn_table: 0xd4a96a,
  furn_chair: 0x8ecae6,
  furn_rug:   0xffd166,
  furn_plant: 0x70b77e,
  furn_lamp:  0xfff3b0,
};
const FURNITURE_FALLBACK = 0xcccccc;

interface FurnitureSprite {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class HouseScene extends Phaser.Scene {
  private furnitureSprites = new Map<string, FurnitureSprite>();
  private cellHighlight!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("House");
  }

  create(): void {
    sendHouseEnter();
    this.cameras.main.setBackgroundColor("#f5e6cc");
    this.cameras.main.setBounds(0, 0, HOUSE_WIDTH, HOUSE_HEIGHT);

    // Zoom to fit the entire house grid in the viewport.
    const zoom = Math.min(
      this.scale.width / HOUSE_WIDTH,
      this.scale.height / HOUSE_HEIGHT,
    ) * 0.95;
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(HOUSE_WIDTH / 2, HOUSE_HEIGHT / 2);

    this.drawFloor();

    // Selection highlight, hidden until a cell is tapped.
    this.cellHighlight = this.add
      .rectangle(0, 0, CELL - 4, CELL - 4, 0xffffff, 0.25)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setDepth(20)
      .setVisible(false);

    this.input.on("pointerdown", this.handlePointerDown, this);
  }

  private drawFloor(): void {
    const g = this.add.graphics().setDepth(-10);

    // Wooden floor — alternating plank shades
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const even = (r + c) % 2 === 0;
        g.fillStyle(even ? 0xecd9b0 : 0xe4ce9e);
        g.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }

    // Grid lines (subtle plank gaps)
    g.lineStyle(1, 0xc8a86a, 0.5);
    for (let c = 0; c <= COLS; c++) g.lineBetween(c * CELL, 0, c * CELL, HOUSE_HEIGHT);
    for (let r = 0; r <= ROWS; r++) g.lineBetween(0, r * CELL, HOUSE_WIDTH, r * CELL);

    // Walls border
    g.lineStyle(6, 0xb08040, 0.9);
    g.strokeRect(0, 0, HOUSE_WIDTH, HOUSE_HEIGHT);

    // Wall baseboards
    g.fillStyle(0xc89a50, 0.4);
    g.fillRect(0, 0, HOUSE_WIDTH, 4);
    g.fillRect(0, HOUSE_HEIGHT - 4, HOUSE_WIDTH, 4);
    g.fillRect(0, 0, 4, HOUSE_HEIGHT);
    g.fillRect(HOUSE_WIDTH - 4, 0, 4, HOUSE_HEIGHT);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(world.x / CELL);
    const row = Math.floor(world.y / CELL);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    // Check for an existing furniture piece at this cell.
    const hit = getFurnitures().find((f) => f.x === col && f.y === row);
    const store = useHouseStore.getState();

    if (hit) {
      store.setSelectedFurnitureId(hit.id);
      this.cellHighlight.setVisible(false);
    } else {
      store.setSelectedCell({ x: col, y: row });
      this.cellHighlight
        .setPosition(col * CELL + CELL / 2, row * CELL + CELL / 2)
        .setVisible(true);
    }
  }

  update(): void {
    // Exit to island when the store flag is cleared (by HousePanel's exit button).
    if (!useHouseStore.getState().inHouse) {
      useHouseStore.getState().setSelectedCell(null);
      useHouseStore.getState().setSelectedFurnitureId(null);
      this.scene.start("Island");
      return;
    }
    this.syncFurniture();
  }

  private syncFurniture(): void {
    const furnitures = getFurnitures();
    const seen = new Set<string>();

    for (const f of furnitures) {
      seen.add(f.id);
      if (!this.furnitureSprites.has(f.id)) {
        const px = f.x * CELL + CELL / 2;
        const py = f.y * CELL + CELL / 2;
        const color = FURNITURE_COLORS[f.item_slug] ?? FURNITURE_FALLBACK;
        const rect = this.add
          .rectangle(px, py, CELL - 8, CELL - 8, color)
          .setStrokeStyle(2, 0x00000022)
          .setDepth(f.z_index + 1);
        const label = this.add
          .text(px, py, f.item_slug.replace("furn_", ""), {
            fontFamily: "sans-serif",
            fontSize: "9px",
            color: "#333333",
          })
          .setOrigin(0.5)
          .setDepth(f.z_index + 2);
        this.furnitureSprites.set(f.id, { rect, label });
      }
    }

    // Destroy sprites for furniture that was removed.
    for (const [id, s] of this.furnitureSprites) {
      if (!seen.has(id)) {
        s.rect.destroy();
        s.label.destroy();
        this.furnitureSprites.delete(id);
      }
    }
  }

  shutdown(): void {
    this.furnitureSprites.forEach((s) => { s.rect.destroy(); s.label.destroy(); });
    this.furnitureSprites.clear();
  }
}
