import { useState } from "react";
import { useMemoryStore } from "../store/useMemoryStore";

const MEMORY_ICONS: Record<string, string> = {
  first_login_together: "💛",
  first_gift:           "🎁",
  first_house_entry:    "🏠",
  first_resource:       "🌿",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function MemoryPanel() {
  const memories = useMemoryStore((s) => s.memories);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="absolute top-4 left-4 flex h-12 w-12 items-center justify-center rounded-full bg-cozy-panel/90 text-2xl shadow-lg backdrop-blur-sm active:scale-95"
        aria-label="Memórias"
      >
        📖
      </button>

      {open && (
        <div className="absolute top-16 left-4 w-72 max-h-[70vh] overflow-y-auto rounded-2xl bg-cozy-panel/98 p-4 shadow-2xl backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-cozy-accent">Nossas Memórias</span>
            <button
              onClick={() => setOpen(false)}
              className="text-xl opacity-50 active:scale-95"
            >
              ×
            </button>
          </div>

          {memories.length === 0 ? (
            <p className="py-6 text-center text-sm text-cozy-soft opacity-50">
              Ainda sem memórias…{"\n"}continue explorando! 🌿
            </p>
          ) : (
            <ul className="space-y-4">
              {memories.map((m) => (
                <li key={m.id} className="flex gap-3 items-start">
                  <span className="mt-0.5 text-2xl">
                    {MEMORY_ICONS[m.kind] ?? "✨"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-cozy-soft">
                      {m.description}
                    </p>
                    <p className="mt-1 text-xs opacity-50">{formatDate(m.occurred_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
