// Must match the backend's realtime world bounds (internal/realtime/world.go).
export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 2000;

export const PLAYER_SPEED = 220; // px per second
export const PLAYER_RADIUS = 16;

// Exponential smoothing rate for remote players. Higher = snappier, lower =
// smoother. Frame-rate independent: alpha = 1 - exp(-dt * RATE).
export const REMOTE_LERP_RATE = 10;

// House entrance position on the island (pixel coords) and detection radius.
export const HOUSE_DOOR_X = 300;
export const HOUSE_DOOR_Y = 300;
export const HOUSE_ENTER_RADIUS = 80;
