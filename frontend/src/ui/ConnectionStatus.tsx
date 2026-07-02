import { useGameStore } from "../store/useGameStore";
import type { ConnectionStatus as Status } from "../net/socket";

const LABEL: Record<Status, string> = {
  idle: "Desconectado",
  connecting: "Conectando…",
  connected: "Online",
  reconnecting: "Reconectando…",
  closed: "Desconectado",
};

const DOT: Record<Status, string> = {
  idle: "bg-gray-400",
  connecting: "bg-yellow-400",
  connected: "bg-green-400",
  reconnecting: "bg-yellow-400 animate-pulse",
  closed: "bg-red-400",
};

export function ConnectionStatus() {
  const status = useGameStore((s) => s.status);
  const count = useGameStore((s) => Object.values(s.players).filter((p) => p.online).length);

  return (
    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-sm text-cozy-soft backdrop-blur-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${DOT[status]}`} />
      <span>{LABEL[status]}</span>
      {status === "connected" && <span className="opacity-70">· {count} na ilha</span>}
    </div>
  );
}
