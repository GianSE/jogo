import { useState } from "react";

interface JoinPanelProps {
  onJoin: (playerId: string, worldId: string) => void;
  error?: string | null;
  loading?: boolean;
}

export function JoinPanel({ onJoin, error, loading }: JoinPanelProps) {
  const [player, setPlayer] = useState("");
  const [world, setWorld] = useState("");

  const submit = () => {
    const p = player.trim();
    const w = world.trim();
    if (p && w) onJoin(p, w);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-72 rounded-2xl bg-cozy-panel p-6 text-cozy-soft shadow-xl">
        <h1 className="mb-1 text-center text-xl font-semibold text-cozy-accent">
          Casinha Virtual
        </h1>
        <p className="mb-5 text-center text-sm opacity-70">Entre na ilha 🌿</p>

        <label className="mb-1 block text-xs opacity-70">Seu nome</label>
        <input
          value={player}
          onChange={(e) => setPlayer(e.target.value)}
          onKeyDown={onKey}
          placeholder="ex: florzinha"
          autoCapitalize="none"
          className="mb-4 w-full rounded-lg bg-black/30 px-3 py-2 text-cozy-soft outline-none placeholder:opacity-40 focus:ring-2 focus:ring-cozy-accent"
        />

        <label className="mb-1 block text-xs opacity-70">Código do mundo</label>
        <input
          value={world}
          onChange={(e) => setWorld(e.target.value)}
          onKeyDown={onKey}
          placeholder="ex: nossa"
          autoCapitalize="none"
          className="mb-6 w-full rounded-lg bg-black/30 px-3 py-2 text-cozy-soft outline-none placeholder:opacity-40 focus:ring-2 focus:ring-cozy-accent"
        />

        {error && (
          <p className="mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-center text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={!player.trim() || !world.trim() || !!loading}
          className="w-full rounded-xl bg-cozy-accent py-3 text-lg font-semibold text-cozy-bg transition-opacity active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar 💛"}
        </button>
      </div>
    </div>
  );
}
