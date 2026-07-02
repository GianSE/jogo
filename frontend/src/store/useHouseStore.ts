import { create } from "zustand";

interface HouseState {
  inHouse: boolean;
  nearHouse: boolean;
  selectedCell: { x: number; y: number } | null;
  selectedFurnitureId: string | null;
  setInHouse: (v: boolean) => void;
  setNearHouse: (v: boolean) => void;
  setSelectedCell: (cell: { x: number; y: number } | null) => void;
  setSelectedFurnitureId: (id: string | null) => void;
}

export const useHouseStore = create<HouseState>((set) => ({
  inHouse: false,
  nearHouse: false,
  selectedCell: null,
  selectedFurnitureId: null,
  setInHouse: (v) => set({ inHouse: v, selectedCell: null, selectedFurnitureId: null }),
  setNearHouse: (v) => set({ nearHouse: v }),
  setSelectedCell: (cell) => set({ selectedCell: cell, selectedFurnitureId: null }),
  setSelectedFurnitureId: (id) => set({ selectedFurnitureId: id, selectedCell: null }),
}));
