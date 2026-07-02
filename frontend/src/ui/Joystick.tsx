import { useRef, useState, type PointerEvent } from "react";
import { setInput } from "../game/input";

const BASE = 128;
const KNOB = 56;
const MAX = (BASE - KNOB) / 2;

/**
 * Virtual joystick for thumb control. Writes the normalized vector to the
 * shared input module (read by the Phaser loop) — it never triggers a game-loop
 * React render.
 */
export function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (e: PointerEvent<HTMLDivElement>) => {
    if (activeId.current !== e.pointerId || !baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX) {
      dx = (dx / dist) * MAX;
      dy = (dy / dist) * MAX;
    }
    setKnob({ x: dx, y: dy });
    setInput(dx / MAX, dy / MAX);
  };

  const start = (e: PointerEvent<HTMLDivElement>) => {
    activeId.current = e.pointerId;
    baseRef.current?.setPointerCapture(e.pointerId);
    update(e);
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (activeId.current !== e.pointerId) return;
    activeId.current = null;
    setKnob({ x: 0, y: 0 });
    setInput(0, 0);
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={start}
      onPointerMove={update}
      onPointerUp={end}
      onPointerCancel={end}
      className="absolute bottom-10 left-8 touch-none select-none"
      style={{ width: BASE, height: BASE }}
    >
      <div className="absolute inset-0 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm" />
      <div
        className="absolute rounded-full border border-white/40 bg-cozy-accent/80"
        style={{
          width: KNOB,
          height: KNOB,
          left: BASE / 2 - KNOB / 2 + knob.x,
          top: BASE / 2 - KNOB / 2 + knob.y,
        }}
      />
    </div>
  );
}
