import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGameStore } from "../store/useGameStore";
import { sendChat } from "../net/outgoing";

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const selfId = useGameStore((s) => s.selfId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message when open.
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const submit = () => {
    if (!draft.trim()) return;
    sendChat(draft);
    setDraft("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-cozy-panel/90 text-2xl shadow-lg backdrop-blur-sm active:scale-95"
        aria-label="Abrir conversa"
      >
        💬
      </button>
    );
  }

  return (
    <div className="absolute right-4 top-4 flex h-[60vh] w-72 max-w-[80vw] flex-col rounded-2xl bg-cozy-panel/95 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-cozy-soft">
        <span className="font-semibold text-cozy-accent">Conversa</span>
        <button onClick={() => setOpen(false)} className="text-xl opacity-70 active:scale-95" aria-label="Fechar">
          ×
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-cozy-soft/50">Nenhuma mensagem ainda 💛</p>
        )}
        {messages.map((m) => {
          const mine = m.sender === selfId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                  mine ? "bg-cozy-accent text-cozy-bg" : "bg-black/30 text-cozy-soft"
                }`}
              >
                {!mine && <div className="mb-0.5 text-xs font-semibold opacity-70">{m.sender}</div>}
                {m.body}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={500}
          placeholder="Escreva algo fofo…"
          className="flex-1 rounded-xl bg-black/30 px-3 py-2 text-sm text-cozy-soft outline-none focus:ring-2 focus:ring-cozy-accent"
        />
        <button
          onClick={submit}
          className="rounded-xl bg-cozy-accent px-4 py-2 text-sm font-semibold text-cozy-bg active:scale-95"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
