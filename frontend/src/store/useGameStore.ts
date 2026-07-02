import { create } from "zustand";
import type { ConnectionStatus } from "../net/socket";
import type { PlayerSnapshot } from "../net/events";

interface GameState {
  status: ConnectionStatus;
  selfId: string | null;
  worldId: string | null;
  players: Record<string, PlayerSnapshot>;

  setStatus: (s: ConnectionStatus) => void;
  setIdentity: (selfId: string, worldId: string) => void;
  upsertPlayer: (p: PlayerSnapshot) => void;
  removePlayer: (id: string) => void;
  setPlayers: (players: PlayerSnapshot[]) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: "idle",
  selfId: null,
  worldId: null,
  players: {},

  setStatus: (status) => set({ status }),
  setIdentity: (selfId, worldId) => set({ selfId, worldId }),
  upsertPlayer: (p) => set((s) => ({ players: { ...s.players, [p.id]: p } })),
  removePlayer: (id) =>
    set((s) => {
      const next = { ...s.players };
      delete next[id];
      return { players: next };
    }),
  setPlayers: (players) =>
    set(() => ({ players: Object.fromEntries(players.map((p) => [p.id, p])) })),
  reset: () => set({ selfId: null, worldId: null, players: {} }),
}));
