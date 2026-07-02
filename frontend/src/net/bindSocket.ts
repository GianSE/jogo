import { socket } from "./socket";
import { useGameStore } from "../store/useGameStore";
import { useChatStore } from "../store/useChatStore";
import { applySnapshot, removePlayer } from "./playerBuffer";
import { setGift, removeGift, clearGifts } from "./giftBuffer";
import { setFurniture, removeFurniture, clearFurnitures } from "./furnitureBuffer";
import { useMemoryStore } from "../store/useMemoryStore";
import type {
  ChatHistoryPayload, ChatItem,
  GiftHistoryPayload, GiftItem, GiftPickupResult,
  FurnitureItem, HouseStatePayload, FurnitureRemoveResult,
  MemoryItem, MemoryHistoryPayload,
  PlayerSnapshot, WorldStatePayload,
} from "./events";

let bound = false;

/**
 * Wire incoming socket events into the two readers of network state:
 *   - the player buffer (high-frequency positions → Phaser), and
 *   - the Zustand store (presence only → React UI).
 *
 * Crucially, player_move updates ONLY the buffer, so a movement packet never
 * triggers a React re-render. Presence changes (join/leave/snapshot) update the
 * store, which the UI re-renders on (rare).
 */
export function bindSocketToStore(): void {
  if (bound) return;
  bound = true;

  const store = useGameStore.getState;

  socket.onStatus((s) => store().setStatus(s));

  socket.on("world_state", (env) => {
    const list = (env.payload as WorldStatePayload).players;
    list.forEach(applySnapshot);
    store().setPlayers(list);
  });

  socket.on("player_join", (env) => {
    const p = env.payload as PlayerSnapshot;
    applySnapshot(p);
    store().upsertPlayer(p);
  });

  socket.on("player_move", (env) => {
    // Buffer only — no store write, no React re-render.
    applySnapshot(env.payload as PlayerSnapshot);
  });

  socket.on("player_leave", (env) => {
    removePlayer(env.player_id);
    store().removePlayer(env.player_id);
  });

  socket.on("chat_history", (env) => {
    useChatStore.getState().setHistory((env.payload as ChatHistoryPayload).messages ?? []);
  });

  socket.on("chat_message", (env) => {
    useChatStore.getState().addMessage(env.payload as ChatItem);
  });

  socket.on("gift_history", (env) => {
    clearGifts();
    ((env.payload as GiftHistoryPayload).gifts ?? []).forEach(setGift);
  });

  socket.on("gift_drop", (env) => {
    setGift(env.payload as GiftItem);
  });

  socket.on("gift_pickup", (env) => {
    removeGift((env.payload as GiftPickupResult).gift_id);
  });

  socket.on("house_state", (env) => {
    clearFurnitures();
    ((env.payload as HouseStatePayload).furniture ?? []).forEach(setFurniture);
  });

  socket.on("furniture_place", (env) => {
    setFurniture(env.payload as FurnitureItem);
  });

  socket.on("furniture_remove", (env) => {
    removeFurniture((env.payload as FurnitureRemoveResult).furniture_id);
  });

  socket.on("memory_history", (env) => {
    useMemoryStore.getState().setHistory((env.payload as MemoryHistoryPayload).memories ?? []);
  });

  socket.on("memory_created", (env) => {
    useMemoryStore.getState().addMemory(env.payload as MemoryItem);
  });
}
