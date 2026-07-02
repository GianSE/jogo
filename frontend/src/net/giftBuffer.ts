import type { GiftItem } from "./events";

/**
 * Non-React buffer of active gifts for Phaser rendering. The net layer writes
 * here on every gift_drop / gift_pickup / gift_history. Phaser reads it each
 * frame to keep gift sprites in sync without triggering React re-renders.
 */
const gifts = new Map<string, GiftItem>();

export function setGift(g: GiftItem): void {
  gifts.set(g.id, g);
}

export function removeGift(id: string): void {
  gifts.delete(id);
}

export function getGifts(): IterableIterator<GiftItem> {
  return gifts.values();
}

export function clearGifts(): void {
  gifts.clear();
}
