import { socket } from "./socket";
import type { Direction } from "./events";

// Outgoing movement is throttled so we never flood the socket. ~12 updates/s
// is plenty for a cozy game and keeps the payload tiny.
const SEND_INTERVAL_MS = 80;

let lastSentAt = 0;
let lastKey = "";

/**
 * sendMove is called every frame by the game loop but only actually emits at
 * the throttled interval, and skips identical consecutive states so a standing
 * player sends nothing. Coordinates are rounded to keep packets small.
 */
export function sendMove(x: number, y: number, direction: Direction): void {
  const now = performance.now();
  if (now - lastSentAt < SEND_INTERVAL_MS) return;

  const rx = Math.round(x);
  const ry = Math.round(y);
  const key = `${rx},${ry},${direction}`;
  if (key === lastKey) return; // unchanged since last send → don't transmit

  lastSentAt = now;
  lastKey = key;
  socket.send("player_move", { x: rx, y: ry, direction, ts: Date.now() });
}

/** Reset throttle state, e.g. after a reconnect. */
export function resetOutgoing(): void {
  lastSentAt = 0;
  lastKey = "";
}

/** Send a chat message. Persistence + broadcast happen server-side. */
export function sendChat(body: string): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  socket.send("chat_message", { body: trimmed });
}

/** Drop a gift at a world position. item_slug must match a gift-category item. */
export function sendGiftDrop(itemSlug: string, x: number, y: number, message?: string): void {
  socket.send("gift_drop", {
    item_slug: itemSlug,
    scene: "island",
    x: Math.round(x),
    y: Math.round(y),
    ...(message?.trim() ? { message: message.trim() } : {}),
  });
}

/** Pick up a gift by its server-assigned id. */
export function sendGiftPickup(giftId: string): void {
  if (!giftId) return;
  socket.send("gift_pickup", { gift_id: giftId });
}

/** Place furniture at a grid cell (0-9 col, 0-7 row). item_slug must be a furniture-category item. */
export function sendFurniturePlace(itemSlug: string, x: number, y: number, rotation = 0): void {
  socket.send("furniture_place", { item_slug: itemSlug, x, y, rotation });
}

/** Remove a furniture piece by its server-assigned id. */
export function sendFurnitureRemove(furnitureId: string): void {
  if (!furnitureId) return;
  socket.send("furniture_remove", { furniture_id: furnitureId });
}

/** Notify the server that this player entered the house scene.
 *  Triggers the first_house_entry memory if it hasn't fired yet. */
export function sendHouseEnter(): void {
  socket.send("house_enter", {});
}
