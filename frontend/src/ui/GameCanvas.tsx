import { useEffect, useRef } from "react";
import { createGame } from "../game/PhaserGame";

/** Mounts the Phaser game into a full-screen div behind the React overlay. */
export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const game = createGame(ref.current);
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={ref} className="absolute inset-0" />;
}
