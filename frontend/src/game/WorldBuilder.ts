import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT, HOUSE_DOOR_X, HOUSE_DOOR_Y } from "./constants";

export interface Obstacle {
  x: number; y: number; w: number; h: number;
}

export interface WorldData {
  treeObstacles:  Obstacle[];
  houseObstacle:  Obstacle;
  fenceObstacles: Obstacle[];
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function buildIsland(scene: Phaser.Scene): WorldData {
  // Ground from Tiled (edit in Tiled Editor, regenerate with: npm run export-map)
  const map     = scene.make.tilemap({ key: "island" });
  const tileset = map.addTilesetImage("grass", "grass")!;
  map.createLayer("Ground", tileset, 0, 0)!.setDepth(-10);

  // Graphics-based elements that Tiled can't represent directly
  drawGroundVariation(scene);
  drawRiver(scene);
  drawPaths(scene);
  addFlowerPatches(scene);

  // Sprites placed from Tiled object layers
  const treeObstacles  = loadTrees(scene, map);
  const fenceObstacles = addFences(scene);
  const houseObstacle  = placeHouse(scene);

  return { treeObstacles, houseObstacle, fenceObstacles };
}

// ─── Ground variation (noise overlay) ────────────────────────────────────────

function drawGroundVariation(scene: Phaser.Scene): void {
  const g   = scene.add.graphics().setDepth(-9);
  const rng = new Phaser.Math.RandomDataGenerator(["gnd"]);
  g.fillStyle(0x000000, 0.04);
  for (let i = 0; i < 120; i++) {
    g.fillEllipse(
      rng.between(0, WORLD_WIDTH),  rng.between(0, WORLD_HEIGHT),
      rng.between(40, 100), rng.between(20, 50),
    );
  }
}

// ─── River ────────────────────────────────────────────────────────────────────

function riverPt(t: number): { x: number; y: number } {
  return {
    x: t * WORLD_WIDTH,
    y: 960
      + Math.sin(t * Math.PI * 1.3) * 60
      + Math.sin(t * Math.PI * 2.7 + 1) * 35
      + Math.cos(t * Math.PI * 0.9) * 25,
  };
}

function traceRiver(g: Phaser.GameObjects.Graphics): void {
  g.beginPath();
  for (let i = 0; i <= 100; i++) {
    const { x, y } = riverPt(i / 100);
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.strokePath();
}

function drawRiver(scene: Phaser.Scene): void {
  const gBank = scene.add.graphics().setDepth(-8);
  gBank.lineStyle(62, 0x5ba88f, 0.3); traceRiver(gBank);

  const gDeep = scene.add.graphics().setDepth(-7);
  gDeep.lineStyle(46, 0x29b6f6, 0.82); traceRiver(gDeep);

  const gShine = scene.add.graphics().setDepth(-6);
  gShine.lineStyle(26, 0x4dd0e1, 0.55); traceRiver(gShine);

  // Sparkle dots
  const sp = scene.add.graphics().setDepth(-5);
  sp.fillStyle(0xffffff, 0.32);
  for (let t = 0; t <= 1; t += 0.025) {
    const { x, y } = riverPt(t);
    sp.fillCircle(x + Math.sin(t * 31) * 12, y + Math.cos(t * 23) * 8,
      2 + Math.sin(t * 47) * 1.5);
  }

  drawBridge(scene, 190, riverPt(0.095).y);
}

function drawBridge(scene: Phaser.Scene, x: number, y: number): void {
  const g = scene.add.graphics().setDepth(-4);
  g.fillStyle(0xc19a6b);
  g.fillRect(x - 22, y - 32, 44, 64);
  g.fillStyle(0x9a7a52);
  g.fillRect(x - 24, y - 34, 5, 68);
  g.fillRect(x + 19, y - 34, 5, 68);
  g.fillRect(x - 24, y - 34, 48, 5);
  g.fillRect(x - 24, y + 29, 48, 5);
  g.lineStyle(1, 0x8b6914, 0.4);
  for (let dy = -28; dy <= 28; dy += 9) g.lineBetween(x - 22, y + dy, x + 22, y + dy);
}

// ─── Paths ────────────────────────────────────────────────────────────────────

function cubicPt(
  t: number,
  x0: number, y0: number, cx1: number, cy1: number,
  cx2: number, cy2: number, x1: number,  y1: number,
): { x: number; y: number } {
  const mt = 1 - t, mt2 = mt * mt, t2 = t * t;
  return {
    x: mt2 * mt * x0 + 3 * mt2 * t * cx1 + 3 * mt * t2 * cx2 + t2 * t * x1,
    y: mt2 * mt * y0 + 3 * mt2 * t * cy1 + 3 * mt * t2 * cy2 + t2 * t * y1,
  };
}

function drawPaths(scene: Phaser.Scene): void {
  const sx = WORLD_WIDTH / 2, sy = WORLD_HEIGHT / 2;
  const ex = HOUSE_DOOR_X,    ey = HOUSE_DOOR_Y + 70;
  const g  = scene.add.graphics().setDepth(-9);

  for (const [lw, col, alpha] of [
    [20, 0xd4a96a, 0.55], [14, 0xba9254, 0.3],
  ] as [number, number, number][]) {
    g.lineStyle(lw, col, alpha);
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const { x, y } = cubicPt(i / 40, sx, sy, 700, 680, 420, 500, ex, ey);
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokePath();
  }
}

// ─── Flowers ──────────────────────────────────────────────────────────────────

function addFlowerPatches(scene: Phaser.Scene): void {
  const rng    = new Phaser.Math.RandomDataGenerator(["flowers-v3"]);
  const COLORS = [0xffccdd, 0xffffaa, 0xccffcc, 0xffaacc, 0xaaccff, 0xffcc88];
  const g      = scene.add.graphics().setDepth(-3);

  for (let i = 0; i < 300; i++) {
    const fx = rng.between(60, WORLD_WIDTH - 60);
    const fy = rng.between(60, WORLD_HEIGHT - 60);
    if (fy > 905 && fy < 1015) continue;
    if (nearHouse(fx, fy, 70)) continue;
    const color = COLORS[rng.between(0, COLORS.length - 1)];
    g.fillStyle(color, 0.9);
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      g.fillCircle(fx + Math.cos(a) * 3.5, fy + Math.sin(a) * 3.5, 2.2);
    }
    g.fillStyle(0xffff88);
    g.fillCircle(fx, fy, 1.8);
  }
}

// ─── Trees from Tiled object layer ───────────────────────────────────────────

function loadTrees(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const layer = map.getObjectLayer("Trees");
  if (!layer) return obstacles;

  for (const obj of layer.objects) {
    const x = obj.x!;
    const y = obj.y!;
    scene.add.ellipse(x + 5, y + 4, 48, 14, 0x000000, 0.18).setDepth(y - 2);
    scene.add.image(x, y, "oak_tree").setOrigin(0.5, 1).setScale(2).setDepth(y);
    obstacles.push({ x: x - 10, y: y - 20, w: 20, h: 22 });
  }

  return obstacles;
}

// ─── Fences around the house ──────────────────────────────────────────────────

function addFences(scene: Phaser.Scene): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const hx = HOUSE_DOOR_X;
  const hy = HOUSE_DOOR_Y;

  const FENCE_SCALE = 1.5;

  function hFence(y: number, x0: number, x1: number): void {
    for (let px = x0; px < x1; px += 30) {
      scene.add.image(px + 15, y, "fence", 0)
        .setScale(FENCE_SCALE)
        .setDepth(y + 1);
    }
    obstacles.push({ x: x0, y: y - 10, w: x1 - x0, h: 14 });
  }

  function vFence(x: number, y0: number, y1: number): void {
    for (let py = y0; py < y1; py += 30) {
      scene.add.image(x, py + 15, "fence", 1)
        .setScale(FENCE_SCALE)
        .setDepth(py + 1);
    }
    obstacles.push({ x: x - 10, y: y0, w: 14, h: y1 - y0 });
  }

  hFence(hy - 95, hx - 80, hx + 80);
  vFence(hx - 80, hy - 95, hy + 18);
  vFence(hx + 80, hy - 95, hy + 18);
  hFence(hy + 18, hx - 80, hx - 22);
  hFence(hy + 18, hx + 22, hx + 80);

  const corners = [
    { x: hx - 80, y: hy - 95 }, { x: hx + 80, y: hy - 95 },
    { x: hx - 80, y: hy + 18 }, { x: hx + 80, y: hy + 18 },
  ];
  for (const c of corners) {
    scene.add.image(c.x, c.y, "fence", 3)
      .setScale(FENCE_SCALE)
      .setDepth(c.y + 2);
  }

  return obstacles;
}

// ─── House ────────────────────────────────────────────────────────────────────

function placeHouse(scene: Phaser.Scene): Obstacle {
  const x = HOUSE_DOOR_X;
  const y = HOUSE_DOOR_Y;
  const d = y;

  scene.add.ellipse(x + 8, y + 10, 110, 26, 0x000000, 0.22).setDepth(d - 2);

  scene.add.image(x, y + 14, "house")
    .setOrigin(0.5, 1)
    .setScale(2)
    .setDepth(d);

  scene.add
    .text(x, y - 124, "Nossa Casinha 🏠", {
      fontSize: "11px",
      color: "#fff5e6",
      fontFamily: "sans-serif",
      stroke: "#5c3010",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(d + 10);

  return { x: x - 86, y: y - 256, w: 172, h: 230 };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nearHouse(x: number, y: number, r: number): boolean {
  return Math.abs(x - HOUSE_DOOR_X) < r && Math.abs(y - HOUSE_DOOR_Y) < r;
}
