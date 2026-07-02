import Phaser from "phaser";

export interface CharacterParts {
  body: Phaser.GameObjects.Rectangle;
  head: Phaser.GameObjects.Arc;
  hair: Phaser.GameObjects.Arc;
  leftLeg: Phaser.GameObjects.Rectangle;
  rightLeg: Phaser.GameObjects.Rectangle;
  eyeL: Phaser.GameObjects.Arc;
  eyeR: Phaser.GameObjects.Arc;
}

export interface RemoteCharacter {
  container: Phaser.GameObjects.Container;
  parts: CharacterParts;
  walkTime: number;
  lastX: number;
  lastY: number;
}

const SKIN = 0xffd5a8;
const PANTS = 0x5588cc;
const HAIR_LOCAL = 0xcc8833;
const HAIR_REMOTE = 0x994422;

export function createCharacter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  name: string,
  shirtColor: number,
  isLocal = false,
): { container: Phaser.GameObjects.Container; parts: CharacterParts } {
  // Draw order: shadow → legs → body → head → hair → eyes → label
  const shadow = scene.add.ellipse(1, 16, 22, 7, 0x000000, 0.18);

  const leftLeg  = scene.add.rectangle(-4,  10, 6, 11, PANTS);
  const rightLeg = scene.add.rectangle( 4,  10, 6, 11, PANTS);

  // Shoes
  const shoeL = scene.add.rectangle(-4, 16, 7, 4, 0x443322);
  const shoeR = scene.add.rectangle( 4, 16, 7, 4, 0x443322);

  const body = scene.add.rectangle(0, 1, 16, 15, shirtColor);
  // Collar highlight
  const collar = scene.add.rectangle(0, -5, 10, 4, Phaser.Display.Color.ValueToColor(shirtColor).lighten(20).color);

  const head = scene.add.arc(0, -13, 8, 0, 360, false, SKIN);
  const hair = scene.add.arc(0, -19, 8, 185, 355, false, isLocal ? HAIR_LOCAL : HAIR_REMOTE);

  const eyeL = scene.add.circle(-3, -14, 1.8, 0x222222);
  const eyeR = scene.add.circle( 3, -14, 1.8, 0x222222);
  // Eye highlights
  const hlL = scene.add.circle(-2.2, -14.6, 0.7, 0xffffff);
  const hlR = scene.add.circle( 3.8, -14.6, 0.7, 0xffffff);

  const label = scene.add
    .text(0, -30, name, {
      fontSize: "11px",
      color: "#ffffff",
      fontFamily: "sans-serif",
      stroke: "#00000066",
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [
    shadow,
    shoeL, shoeR,
    leftLeg, rightLeg,
    body, collar,
    head, hair,
    eyeL, eyeR, hlL, hlR,
    label,
  ]);
  container.setDepth(y);

  const parts: CharacterParts = { body, head, hair, leftLeg, rightLeg, eyeL, eyeR };
  return { container, parts };
}

export function animateCharacter(
  parts: CharacterParts,
  container: Phaser.GameObjects.Container,
  isMoving: boolean,
  direction: string,
  walkTime: number,
): void {
  if (isMoving) {
    const swing = Math.sin(walkTime * 7) * 5;
    const bob   = Math.abs(Math.sin(walkTime * 7)) * 1.5;

    parts.leftLeg.setY(10 + swing);
    parts.rightLeg.setY(10 - swing);
    parts.body.setY(1 - bob * 0.4);
    parts.head.setY(-13 - bob * 0.4);
    parts.hair.setY(-19 - bob * 0.4);
  } else {
    parts.leftLeg.setY(10);
    parts.rightLeg.setY(10);
    parts.body.setY(1);
    parts.head.setY(-13);
    parts.hair.setY(-19);
  }

  // Direction-based eye/hair adjustments
  switch (direction) {
    case "left":
      parts.eyeL.setVisible(false);
      parts.eyeR.setPosition(0, -14).setVisible(true);
      parts.head.setFillStyle(SKIN);
      parts.hair.setFillStyle(parts.hair.fillColor);
      break;
    case "right":
      parts.eyeR.setVisible(false);
      parts.eyeL.setPosition(0, -14).setVisible(true);
      parts.head.setFillStyle(SKIN);
      break;
    case "up":
      parts.eyeL.setVisible(false);
      parts.eyeR.setVisible(false);
      parts.head.setFillStyle(0xc49070); // back of head
      break;
    default: // down
      parts.eyeL.setPosition(-3, -14).setVisible(true);
      parts.eyeR.setPosition( 3, -14).setVisible(true);
      parts.head.setFillStyle(SKIN);
  }

  container.setDepth(container.y);
}
