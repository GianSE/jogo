import Phaser from "phaser";
import { input } from "./input";
import {
  HOUSE_DOOR_X,
  HOUSE_DOOR_Y,
  HOUSE_ENTER_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  REMOTE_LERP_RATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { getPlayer, getPlayers } from "../net/playerBuffer";
import { getGifts } from "../net/giftBuffer";
import { sendMove } from "../net/outgoing";
import { useGameStore } from "../store/useGameStore";
import { useGiftStore } from "../store/useGiftStore";
import { useHouseStore } from "../store/useHouseStore";
import type { Direction } from "../net/events";
import { buildIsland } from "./WorldBuilder";
import { spawnAnimals, updateAnimals } from "./NPCAnimals";
import type { AnimalNPC } from "./NPCAnimals";

const GIFT_PICKUP_RADIUS = 80;
const GIFT_COLORS: Record<string, number> = {
  gift_flower: 0xff9ec2,
  gift_letter: 0xfff176,
  gift_shell:  0x80deea,
  gift_cake:   0xffcc80,
};

// Remote player entry
interface RemoteEntry {
  sprite: Phaser.GameObjects.Sprite;
  label:  Phaser.GameObjects.Text;
  lastX:  number;
  lastY:  number;
}

export class IslandScene extends Phaser.Scene {
  // Local player
  private player!: Phaser.GameObjects.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private facing: Direction = "down";
  private localInitialized = false;

  // Remote players
  private remotes = new Map<string, RemoteEntry>();

  // Gifts
  private giftSprites = new Map<string, Phaser.GameObjects.Arc>();

  // Animals
  private animals: AnimalNPC[] = [];

  // Keyboard
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  // Change-trackers (avoid needless store writes every frame)
  private lastNearbyGiftId: string | null = null;
  private lastNearHouse = false;

  constructor() {
    super("Island");
  }

  create(): void {
    buildIsland(this);

    // ── Local player sprite ──────────────────────────────────────────────────
    this.player = this.add.sprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, "player");
    this.player.setScale(2);
    this.player.setOrigin(0.5, 0.75); // anchor slightly below center for depth sorting
    this.player.play("idle-down");
    this.player.setDepth(this.player.y);

    // Name label — follows the sprite each frame
    const selfId = useGameStore.getState().selfId ?? "você";
    this.playerLabel = this.add
      .text(this.player.x, this.player.y - 56, selfId, {
        fontSize: "11px",
        color: "#ffffff",
        fontFamily: "sans-serif",
        stroke: "#00000066",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(99999);

    // Camera
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // Keyboard
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd    = kb.addKeys("W,A,S,D") as typeof this.wasd;

    // Wandering animals
    this.animals = spawnAnimals(this);
  }

  update(_time: number, delta: number): void {
    if (useHouseStore.getState().inHouse) {
      this.scene.start("House");
      return;
    }

    const dt     = delta / 1000;
    const selfId = useGameStore.getState().selfId;

    // Snap to server-authoritative position once on connect / reconnect
    if (!this.localInitialized && selfId) {
      const me = getPlayer(selfId);
      if (me) {
        this.player.setPosition(me.x, me.y);
        this.localInitialized = true;
      }
    }

    const moved = this.moveLocal(dt);
    this.playPlayerAnim(moved);
    this.player.setDepth(this.player.y);
    this.playerLabel.setPosition(this.player.x, this.player.y - 56);

    if (selfId) sendMove(this.player.x, this.player.y, this.facing);

    this.syncRemotes(dt, selfId);
    this.syncGifts();
    this.checkHouseDoor();
    updateAnimals(this.animals, dt);
  }

  // ─── Movement ─────────────────────────────────────────────────────────────

  private moveLocal(dt: number): boolean {
    let vx = input.x;
    let vy = input.y;

    if (this.cursors.left.isDown  || this.wasd.A.isDown) vx = -1;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) vx =  1;
    if (this.cursors.up.isDown    || this.wasd.W.isDown) vy = -1;
    else if (this.cursors.down.isDown  || this.wasd.S.isDown) vy =  1;

    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }

    if (vx !== 0 || vy !== 0) {
      this.facing =
        Math.abs(vx) >= Math.abs(vy)
          ? vx > 0 ? "right" : "left"
          : vy > 0 ? "down" : "up";
    }

    this.player.x = Phaser.Math.Clamp(
      this.player.x + vx * PLAYER_SPEED * dt,
      PLAYER_RADIUS, WORLD_WIDTH  - PLAYER_RADIUS,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + vy * PLAYER_SPEED * dt,
      PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS,
    );

    return vx !== 0 || vy !== 0;
  }

  private playPlayerAnim(moved: boolean): void {
    const key = moved ? `walk-${this.facing}` : `idle-${this.facing}`;
    if (this.player.anims.currentAnim?.key !== key) this.player.play(key);
  }

  // ─── Remote players ───────────────────────────────────────────────────────

  private syncRemotes(dt: number, selfId: string | null): void {
    const alpha = 1 - Math.exp(-dt * REMOTE_LERP_RATE);
    const seen  = new Set<string>();

    for (const p of getPlayers()) {
      if (p.id === selfId || !p.online) continue;
      seen.add(p.id);

      let r = this.remotes.get(p.id);
      if (!r) {
        const sprite = this.add.sprite(p.x, p.y, "player");
        sprite.setScale(2).setOrigin(0.5, 0.75);
        sprite.setTint(0x88aaff); // blue tint for the partner
        sprite.play("idle-down");

        const label = this.add
          .text(p.x, p.y - 56, p.id, {
            fontSize: "11px",
            color: "#cce4ff",
            fontFamily: "sans-serif",
            stroke: "#00000066",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(99999);

        r = { sprite, label, lastX: p.x, lastY: p.y };
        this.remotes.set(p.id, r);
      }

      // Smooth lerp toward server position
      r.sprite.x = Phaser.Math.Linear(r.sprite.x, p.x, alpha);
      r.sprite.y = Phaser.Math.Linear(r.sprite.y, p.y, alpha);
      r.sprite.setDepth(r.sprite.y);

      // Play walk/idle animation based on movement
      const moving = Math.hypot(p.x - r.lastX, p.y - r.lastY) > 1;
      r.lastX = p.x;
      r.lastY = p.y;
      const dir = (p.direction as Direction) ?? "down";
      const animKey = moving ? `walk-${dir}` : `idle-${dir}`;
      if (r.sprite.anims.currentAnim?.key !== animKey) r.sprite.play(animKey);

      r.label.setPosition(r.sprite.x, r.sprite.y - 56).setDepth(r.sprite.depth + 1);
    }

    for (const [id, r] of this.remotes) {
      if (!seen.has(id)) {
        r.sprite.destroy();
        r.label.destroy();
        this.remotes.delete(id);
      }
    }
  }

  // ─── Gifts ────────────────────────────────────────────────────────────────

  private syncGifts(): void {
    const seen = new Set<string>();
    let nearbyId: string | null = null;
    let nearestDist = Infinity;

    for (const g of getGifts()) {
      if (g.scene !== "island") continue;
      seen.add(g.id);

      if (!this.giftSprites.has(g.id)) {
        const color  = GIFT_COLORS[g.item_slug] ?? 0xffffff;
        const sprite = this.add
          .circle(g.x, g.y, 10, color)
          .setDepth(g.y + 1)
          .setStrokeStyle(2, 0xffffff);
        this.giftSprites.set(g.id, sprite);
      }

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, g.x, g.y);
      if (dist < GIFT_PICKUP_RADIUS && dist < nearestDist) {
        nearestDist = dist;
        nearbyId    = g.id;
      }
    }

    for (const [id, sprite] of this.giftSprites) {
      if (!seen.has(id)) { sprite.destroy(); this.giftSprites.delete(id); }
    }

    if (nearbyId !== this.lastNearbyGiftId) {
      this.lastNearbyGiftId = nearbyId;
      useGiftStore.getState().setNearbyGift(nearbyId);
    }
  }

  // ─── House proximity ──────────────────────────────────────────────────────

  private checkHouseDoor(): void {
    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      HOUSE_DOOR_X, HOUSE_DOOR_Y,
    );
    const near = dist < HOUSE_ENTER_RADIUS;
    if (near !== this.lastNearHouse) {
      this.lastNearHouse = near;
      useHouseStore.getState().setNearHouse(near);
    }
  }
}
