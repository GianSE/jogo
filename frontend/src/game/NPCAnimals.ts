import Phaser from "phaser";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants";

export interface AnimalNPC {
  sprite:     Phaser.GameObjects.Sprite;
  type:       string;
  home:       { x: number; y: number };
  vx:         number;
  vy:         number;
  moveTimer:  number;
  homeRadius: number;
  speed:      number;
}

const SPAWNS: { x: number; y: number; type: string }[] = [
  { x: 460,  y: 350, type: "chicken" },
  { x: 1050, y: 480, type: "pig"     },
  { x: 580,  y: 240, type: "sheep"   },
  { x: 1430, y: 390, type: "chicken" },
  { x: 230,  y: 430, type: "cow"     },
  { x: 1650, y: 210, type: "sheep"   },
  { x: 360,  y: 210, type: "pig"     },
  { x: 920,  y: 260, type: "chicken" },
];

const SPEEDS: Record<string, number> = {
  chicken: 40,
  pig:     28,
  sheep:   30,
  cow:     22,
};

export function spawnAnimals(scene: Phaser.Scene): AnimalNPC[] {
  return SPAWNS.map((s) => {
    const sprite = scene.add.sprite(s.x, s.y, s.type);
    sprite.setScale(2);
    sprite.setOrigin(0.5, 0.75);
    sprite.play(`${s.type}-idle`);
    sprite.setDepth(s.y);

    return {
      sprite,
      type:       s.type,
      home:       { x: s.x, y: s.y },
      vx:         0,
      vy:         0,
      moveTimer:  Math.random() * 2,
      homeRadius: 160,
      speed:      SPEEDS[s.type] ?? 30,
    };
  });
}

export function updateAnimals(animals: AnimalNPC[], dt: number): void {
  for (const a of animals) tick(a, dt);
}

function tick(a: AnimalNPC, dt: number): void {
  a.moveTimer -= dt;

  if (a.moveTimer <= 0) {
    if (Math.random() < 0.38) {
      // Pause
      a.vx = 0;
      a.vy = 0;
      a.moveTimer = 0.7 + Math.random() * 1.5;
    } else {
      // Pick a new random direction
      const angle = Math.random() * Math.PI * 2;
      a.vx = Math.cos(angle) * a.speed;
      a.vy = Math.sin(angle) * a.speed;
      a.moveTimer = 1.0 + Math.random() * 2.2;
    }
  }

  const isMoving = a.vx !== 0 || a.vy !== 0;

  if (isMoving) {
    const nx = a.sprite.x + a.vx * dt;
    const ny = a.sprite.y + a.vy * dt;
    const d  = Phaser.Math.Distance.Between(nx, ny, a.home.x, a.home.y);

    if (d < a.homeRadius) {
      a.sprite.setX(Phaser.Math.Clamp(nx, 80, WORLD_WIDTH  - 80));
      a.sprite.setY(Phaser.Math.Clamp(ny, 80, WORLD_HEIGHT - 80));
    } else {
      // Nudge back toward home territory
      a.vx = (a.home.x - a.sprite.x) * 0.4;
      a.vy = (a.home.y - a.sprite.y) * 0.4;
      a.moveTimer = 0.8;
    }

    // Flip sprite to face movement direction
    if (a.vx < 0) a.sprite.setFlipX(true);
    else if (a.vx > 0) a.sprite.setFlipX(false);

    a.sprite.play(`${a.type}-walk`, true);
  } else {
    a.sprite.play(`${a.type}-idle`, true);
  }

  a.sprite.setDepth(a.sprite.y);
}
