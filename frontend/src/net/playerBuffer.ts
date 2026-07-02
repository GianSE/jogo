import type { Direction, PlayerSnapshot } from "./events";

/**
 * Non-React buffer of the latest authoritative player positions. The net layer
 * writes here on every player_move; the Phaser loop reads here every frame to
 * interpolate. Keeping high-frequency position data out of Zustand avoids a
 * React re-render per movement packet (the store is for UI presence only).
 */
export interface BufferedPlayer {
  id: string;
  x: number; // latest server-authoritative target
  y: number;
  direction: Direction;
  online: boolean;
}

const players = new Map<string, BufferedPlayer>();

export function applySnapshot(p: PlayerSnapshot): void {
  const existing = players.get(p.id);
  if (existing) {
    existing.x = p.x;
    existing.y = p.y;
    existing.direction = p.direction;
    existing.online = p.online;
  } else {
    players.set(p.id, { id: p.id, x: p.x, y: p.y, direction: p.direction, online: p.online });
  }
}

export function removePlayer(id: string): void {
  players.delete(id);
}

export function getPlayer(id: string): BufferedPlayer | undefined {
  return players.get(id);
}

export function getPlayers(): IterableIterator<BufferedPlayer> {
  return players.values();
}

export function clearPlayers(): void {
  players.clear();
}
