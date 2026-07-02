import type { Envelope, EventType } from "./events";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

type MessageHandler = (env: Envelope) => void;
type StatusHandler = (status: ConnectionStatus) => void;

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

/** Derive the ws(s):// URL for the gameplay socket from the HTTP API base. */
function wsURL(token: string): string {
  const u = new URL("/ws", API_BASE);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.searchParams.set("token", token);
  return u.toString();
}

/** Dev-only helper: ask the backend to mint a token for a player + world. */
export async function fetchDevToken(playerId: string, worldId: string): Promise<string> {
  const u = new URL("/api/dev/token", API_BASE);
  u.searchParams.set("player_id", playerId);
  u.searchParams.set("world_id", worldId);
  const res = await fetch(u.toString(), { method: "POST" });
  if (!res.ok) throw new Error(`token request failed: ${res.status}`);
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("no token in response");
  return body.token;
}

/**
 * GameSocket is the single owner of the WebSocket connection. It auto-reconnects
 * with backoff, re-using the same token, and fans messages out to subscribers.
 * The Phaser scene and React UI both consume it via this one object.
 */
export class GameSocket {
  private ws: WebSocket | null = null;
  private token = "";
  private manualClose = false;
  private backoff = 1000;
  private readonly maxBackoff = 15000;

  private handlers = new Map<EventType, Set<MessageHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private status: ConnectionStatus = "idle";

  connect(token: string): void {
    this.token = token;
    this.manualClose = false;
    this.open();
  }

  private open(): void {
    this.setStatus(this.status === "closed" || this.status === "reconnecting" ? "reconnecting" : "connecting");

    const ws = new WebSocket(wsURL(this.token));
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.setStatus("connected");
    };

    ws.onmessage = (ev) => {
      let env: Envelope;
      try {
        env = JSON.parse(ev.data as string) as Envelope;
      } catch {
        return;
      }
      this.handlers.get(env.type)?.forEach((h) => h(env));
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.manualClose) {
        this.setStatus("closed");
        return;
      }
      this.setStatus("reconnecting");
      setTimeout(() => this.open(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
    };

    ws.onerror = () => ws.close();
  }

  send<T>(type: EventType, payload: T): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    // world_id/player_id are filled in by the server from the token; we omit them.
    const env = { type, world_id: "", player_id: "", payload };
    this.ws.send(JSON.stringify(env));
  }

  on(type: EventType, handler: MessageHandler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  close(): void {
    this.manualClose = true;
    this.ws?.close();
  }

  private setStatus(s: ConnectionStatus): void {
    this.status = s;
    this.statusHandlers.forEach((h) => h(s));
  }
}

// Single shared instance for the whole app.
export const socket = new GameSocket();
