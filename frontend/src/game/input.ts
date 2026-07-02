import type { Direction } from "../net/events";

// Shared movement intent, written by the React joystick and read by the Phaser
// update loop. A plain module-level object keeps React re-renders out of the
// 60 FPS game loop entirely.
export interface InputState {
  x: number; // -1..1
  y: number; // -1..1
  direction: Direction;
}

export const input: InputState = { x: 0, y: 0, direction: "down" };

export function setInput(x: number, y: number): void {
  input.x = x;
  input.y = y;
  if (x === 0 && y === 0) return;
  if (Math.abs(x) >= Math.abs(y)) {
    input.direction = x > 0 ? "right" : "left";
  } else {
    input.direction = y > 0 ? "down" : "up";
  }
}
