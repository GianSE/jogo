import { create } from "zustand";

interface GiftState {
  // ID of the gift nearest to the local player (set by Phaser, read by React).
  nearbyGiftId: string | null;
  setNearbyGift: (id: string | null) => void;
}

export const useGiftStore = create<GiftState>((set) => ({
  nearbyGiftId: null,
  setNearbyGift: (id) => set({ nearbyGiftId: id }),
}));
