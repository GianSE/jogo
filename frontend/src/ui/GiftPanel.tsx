import { useState } from "react";
import { useGiftStore } from "../store/useGiftStore";
import { sendGiftDrop, sendGiftPickup } from "../net/outgoing";
import { useGameStore } from "../store/useGameStore";

const GIFT_OPTIONS = [
  { slug: "gift_flower", emoji: "🌸", label: "Flor" },
  { slug: "gift_letter", emoji: "💌", label: "Carta" },
  { slug: "gift_shell",  emoji: "🐚", label: "Concha" },
  { slug: "gift_cake",   emoji: "🧁", label: "Bolinho" },
];

export function GiftPanel() {
  const nearbyGiftId = useGiftStore((s) => s.nearbyGiftId);
  const selfId = useGameStore((s) => s.selfId);
  const players = useGameStore((s) => s.players);

  const [open, setOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(GIFT_OPTIONS[0].slug);
  const [message, setMessage] = useState("");

  // Find the local player's current Phaser position. We read it from the store
  // (set on join/reconnect); for drop position we use the server-echoed coords.
  const localPlayer = selfId ? players[selfId] : undefined;

  const drop = () => {
    if (!localPlayer) return;
    sendGiftDrop(selectedSlug, localPlayer.x, localPlayer.y, message || undefined);
    setMessage("");
    setOpen(false);
  };

  const pickup = () => {
    if (!nearbyGiftId) return;
    sendGiftPickup(nearbyGiftId);
  };

  return (
    <>
      {/* Pickup prompt — floats above the right action area when near a gift */}
      {nearbyGiftId && !open && (
        <button
          onClick={pickup}
          className="absolute bottom-40 right-6 rounded-2xl bg-cozy-accent px-5 py-3 text-base font-semibold text-cozy-bg shadow-lg active:scale-95"
        >
          Pegar presente 🎁
        </button>
      )}

      {/* Drop button — bottom right thumb zone */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="absolute bottom-10 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-cozy-panel/90 text-2xl shadow-lg backdrop-blur-sm active:scale-95"
          aria-label="Deixar presente"
        >
          🎀
        </button>
      )}

      {/* Drop panel */}
      {open && (
        <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-cozy-panel/98 p-5 shadow-2xl backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-semibold text-cozy-accent">Deixar um presente</span>
            <button onClick={() => setOpen(false)} className="text-2xl opacity-60 active:scale-95">×</button>
          </div>

          {/* Item selector */}
          <div className="mb-4 flex justify-around">
            {GIFT_OPTIONS.map((opt) => (
              <button
                key={opt.slug}
                onClick={() => setSelectedSlug(opt.slug)}
                className={`flex flex-col items-center gap-1 rounded-2xl px-4 py-3 text-3xl transition-colors ${
                  selectedSlug === opt.slug
                    ? "bg-cozy-accent/20 ring-2 ring-cozy-accent"
                    : "bg-black/20"
                }`}
              >
                {opt.emoji}
                <span className="text-xs text-cozy-soft/70">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Optional message */}
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={280}
            placeholder="Uma mensagem fofa… (opcional)"
            className="mb-4 w-full rounded-xl bg-black/30 px-4 py-3 text-sm text-cozy-soft outline-none focus:ring-2 focus:ring-cozy-accent"
          />

          <button
            onClick={drop}
            disabled={!localPlayer}
            className="w-full rounded-2xl bg-cozy-accent py-4 text-lg font-semibold text-cozy-bg active:scale-[0.98] disabled:opacity-40"
          >
            Deixar aqui 💛
          </button>
        </div>
      )}
    </>
  );
}
