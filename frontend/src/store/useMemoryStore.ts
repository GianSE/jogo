import { create } from "zustand";
import type { MemoryItem } from "../net/events";

interface MemoryState {
  memories: MemoryItem[];
  addMemory: (m: MemoryItem) => void;
  setHistory: (memories: MemoryItem[]) => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  memories: [],
  addMemory: (m) => set((s) => ({ memories: [...s.memories, m] })),
  setHistory: (memories) => set({ memories }),
}));
