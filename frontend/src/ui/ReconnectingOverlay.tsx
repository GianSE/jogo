import { useGameStore } from "../store/useGameStore";

export function ReconnectingOverlay() {
  const status = useGameStore((s) => s.status);
  if (status !== "reconnecting") return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-36 flex justify-center">
      <div className="animate-pulse rounded-2xl bg-black/70 px-5 py-2.5 text-sm text-cozy-soft backdrop-blur-sm">
        Reconectando… 🌿
      </div>
    </div>
  );
}
