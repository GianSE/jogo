/**
 * Generates frontend/public/assets/maps/island.json for Tiled Editor.
 * Mirrors the seeded RNG and tree-placement logic in WorldBuilder.ts exactly,
 * so the initial exported map matches what the game currently renders.
 *
 * Usage:  node scripts/export-tiled-map.mjs
 *         npm run export-map  (from frontend/)
 */

const WORLD_WIDTH  = 2000;
const WORLD_HEIGHT = 2000;
const TILE_SIZE    = 16;
const MAP_W        = WORLD_WIDTH  / TILE_SIZE; // 125
const MAP_H        = WORLD_HEIGHT / TILE_SIZE; // 125
const HOUSE_DOOR_X = 300;
const HOUSE_DOOR_Y = 300;

// ─── Phaser RandomDataGenerator (Alea algorithm) ─────────────────────────────
// Copied verbatim from Phaser 3 source so tree positions match exactly.

class RandomDataGenerator {
  constructor(seeds) {
    this.c = 1; this.s0 = 0; this.s1 = 0; this.s2 = 0; this.n = 0;
    if (seeds) this.sow(seeds);
  }

  hash(data) {
    let h, n = this.n;
    data = String(data);
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      h  = 0.02519603282416938 * n;
      n  = h >>> 0;
      h -= n; h *= n; n = h >>> 0; h -= n; n += h * 0x100000000;
    }
    this.n = n;
    return (n >>> 0) * 2.3283064365386963e-10;
  }

  sow(seeds) {
    this.n  = 0xefc8249d;
    this.s0 = this.hash(' ');
    this.s1 = this.hash(' ');
    this.s2 = this.hash(' ');
    this.c  = 1;
    for (const seed of seeds) {
      this.s0 -= this.hash(seed); this.s0 += ~~(this.s0 < 0);
      this.s1 -= this.hash(seed); this.s1 += ~~(this.s1 < 0);
      this.s2 -= this.hash(seed); this.s2 += ~~(this.s2 < 0);
    }
  }

  rnd() {
    const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10;
    this.c  = t | 0;
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.s2 = t - this.c;
    return this.s2;
  }

  between(min, max) { return Math.floor(this.rnd() * (max - min + 1) + min); }
}

// ─── Tree positions (mirrors addAllTrees in WorldBuilder.ts) ─────────────────

function nearHouse(x, y, r) {
  return Math.abs(x - HOUSE_DOOR_X) < r && Math.abs(y - HOUSE_DOOR_Y) < r;
}
function nearSpawn(x, y, r) {
  return Math.abs(x - WORLD_WIDTH / 2) < r && Math.abs(y - WORLD_HEIGHT / 2) < r;
}

function computeTreePositions() {
  const rng  = new RandomDataGenerator(["trees-v3"]);
  const trees = [];

  const clusters = [
    { x: 500,  y: 380,  n: 6 }, { x: 1200, y: 280,  n: 5 },
    { x: 820,  y: 680,  n: 4 }, { x: 1520, y: 580,  n: 7 },
    { x: 210,  y: 1220, n: 5 }, { x: 1820, y: 1120, n: 6 },
    { x: 620,  y: 1520, n: 4 }, { x: 1320, y: 1640, n: 5 },
    { x: 1720, y: 1820, n: 4 }, { x: 420,  y: 1820, n: 6 },
    { x: 1020, y: 1320, n: 5 }, { x: 110,  y: 620,  n: 4 },
    { x: 1920, y: 420,  n: 5 }, { x: 1400, y: 1200, n: 4 },
    { x: 700,  y: 1180, n: 5 },
  ];

  function tryAdd(x, y) {
    if (y > 880 && y < 1040) return;          // river zone
    if (nearHouse(x, y, 130))  return;
    if (nearSpawn(x, y, 100))  return;
    trees.push({ x, y });
  }

  for (const c of clusters) {
    for (let i = 0; i < c.n; i++) {
      tryAdd(c.x + rng.between(-85, 85), c.y + rng.between(-85, 85));
    }
  }
  for (let i = 0; i < 45; i++) {
    tryAdd(rng.between(80, WORLD_WIDTH - 80), rng.between(80, WORLD_HEIGHT - 80));
  }

  // Border trees
  const m = 35, step = 110;
  for (let x = m; x < WORLD_WIDTH - m; x += step + rng.between(-15, 15)) {
    tryAdd(x, m + rng.between(-8, 8));
    tryAdd(x, WORLD_HEIGHT - m + rng.between(-8, 8));
  }
  for (let y = m + step; y < WORLD_HEIGHT - m - step; y += step + rng.between(-15, 15)) {
    tryAdd(m + rng.between(-8, 8), y);
    tryAdd(WORLD_WIDTH - m + rng.between(-8, 8), y);
  }

  return trees;
}

// ─── Build Tiled JSON ─────────────────────────────────────────────────────────

function buildTiledMap() {
  const trees = computeTreePositions();

  // Ground layer: every tile is GID 1 (grass)
  const groundData = new Array(MAP_W * MAP_H).fill(1);

  let nextId = 1;
  const obj = (name, x, y) => ({
    id: nextId++, name, type: "", x, y,
    width: 0, height: 0, rotation: 0, visible: true,
  });

  const treeObjects  = trees.map(({ x, y }) => obj("tree", x, y));
  const houseObjects = [obj("house", HOUSE_DOOR_X, HOUSE_DOOR_Y)];
  const spawnObjects = [obj("spawn", WORLD_WIDTH / 2, WORLD_HEIGHT / 2)];

  const layer = (id, name, type, extra) => ({
    type, id, name, visible: true, opacity: 1, x: 0, y: 0, ...extra,
  });

  return {
    type: "map",
    version: "1.10",
    tiledversion: "1.10.2",
    orientation: "orthogonal",
    renderorder: "right-down",
    width: MAP_W,
    height: MAP_H,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    infinite: false,
    nextlayerid: 5,
    nextobjectid: nextId,
    tilesets: [
      {
        columns: 1,
        firstgid: 1,
        image: "../../tiles/grass.png",
        imageheight: TILE_SIZE,
        imagewidth: TILE_SIZE,
        margin: 0,
        name: "grass",
        spacing: 0,
        tilecount: 1,
        tileheight: TILE_SIZE,
        tilewidth: TILE_SIZE,
      },
    ],
    layers: [
      layer(1, "Ground", "tilelayer", { width: MAP_W, height: MAP_H, data: groundData }),
      layer(2, "Trees",  "objectgroup", { objects: treeObjects,  draworder: "topdown" }),
      layer(3, "House",  "objectgroup", { objects: houseObjects, draworder: "topdown" }),
      layer(4, "Spawn",  "objectgroup", { objects: spawnObjects, draworder: "topdown" }),
    ],
  };
}

// ─── Write output ─────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname }            from "path";
import { fileURLToPath }            from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir    = join(__dirname, "../frontend/public/assets/maps");
const outFile   = join(outDir, "island.json");

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(buildTiledMap(), null, 2));

const treeCount = computeTreePositions().length;
console.log(`✓  island.json written → ${outFile}`);
console.log(`   ${MAP_W}×${MAP_H} tiles  |  ${treeCount} trees  |  Tiled 1.10 format`);
