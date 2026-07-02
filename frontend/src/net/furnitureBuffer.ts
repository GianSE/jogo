import type { FurnitureItem } from "./events";

const buffer = new Map<string, FurnitureItem>();

export function setFurniture(f: FurnitureItem): void { buffer.set(f.id, f); }
export function removeFurniture(id: string): void { buffer.delete(id); }
export function getFurnitures(): FurnitureItem[] { return [...buffer.values()]; }
export function clearFurnitures(): void { buffer.clear(); }
