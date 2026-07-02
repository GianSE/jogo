import Phaser from "phaser";
import { BootScene } from "./BootScene";
import { IslandScene } from "./IslandScene";
import { HouseScene } from "./HouseScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#1b1726",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: false,  // crisp pixel art
      pixelArt: true,
      roundPixels: true,
    },
    // Arcade Physics — top-down, zero gravity
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [BootScene, IslandScene, HouseScene],
  });
}
