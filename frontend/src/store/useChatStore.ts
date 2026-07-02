import { create } from "zustand";
import type { ChatItem } from "../net/events";

const MAX_MESSAGES = 200;

interface ChatState {
  messages: ChatItem[];
  addMessage: (m: ChatItem) => void;
  setHistory: (messages: ChatItem[]) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (m) =>
    set((s) => ({ messages: [...s.messages, m].slice(-MAX_MESSAGES) })),
  setHistory: (messages) => set({ messages: messages.slice(-MAX_MESSAGES) }),
  clear: () => set({ messages: [] }),
}));
