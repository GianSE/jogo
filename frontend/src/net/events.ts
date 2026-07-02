// Wire contract — mirrors the Go backend's realtime.Envelope.

export type EventType =
  | "player_join"
  | "player_leave"
  | "player_move"
  | "chat_message"
  | "chat_history"
  | "gift_drop"
  | "gift_pickup"
  | "gift_history"
  | "world_state"
  | "furniture_place"
  | "furniture_remove"
  | "house_state"
  | "house_enter"
  | "memory_history"
  | "memory_created";

export type Direction = "up" | "down" | "left" | "right";

export interface Envelope<T = unknown> {
  type: EventType;
  world_id: string;
  player_id: string;
  payload: T;
}

export interface PlayerSnapshot {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  online: boolean;
}

export interface WorldStatePayload {
  players: PlayerSnapshot[];
}

export interface MovePayload {
  x: number;
  y: number;
  direction: Direction;
}

export interface ChatPayload {
  body: string;
}

// Persisted chat message as broadcast / replayed by the server.
export interface ChatItem {
  id: number;
  sender: string;
  body: string;
  at: string; // RFC3339
}

export interface ChatHistoryPayload {
  messages: ChatItem[];
}

// Gift item as broadcast / replayed by the server.
export interface GiftItem {
  id: string;
  item_slug: string;
  from: string;   // sender handle
  scene: string;
  x: number;
  y: number;
  message?: string;
  at: string; // RFC3339
}

export interface GiftHistoryPayload {
  gifts: GiftItem[];
}

export interface GiftPickupResult {
  gift_id: string;
  picked_by: string;
}

// Client → server gift drop request.
export interface GiftDropRequest {
  item_slug: string;
  scene: string;
  x: number;
  y: number;
  message?: string;
}

export interface FurnitureItem {
  id: string;
  item_slug: string;
  placed_by: string;
  x: number;
  y: number;
  rotation: number;
  z_index: number;
}

export interface HouseStatePayload {
  furniture: FurnitureItem[];
}

export interface FurnitureRemoveResult {
  furniture_id: string;
  removed_by: string;
}

export interface MemoryItem {
  id: string;
  kind: string;
  description: string;
  occurred_at: string; // RFC3339
}

export interface MemoryHistoryPayload {
  memories: MemoryItem[];
}
