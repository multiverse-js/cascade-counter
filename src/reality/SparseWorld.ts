import type { Coord, WorldOptions } from "./types";
import { BaseWorld } from "./World";

export class SparseWorld<T> extends BaseWorld<T> {
  private readonly cells: Map<string, T>;

  constructor(options: WorldOptions<T>) {
    super({ ...options, backend: "sparse" });
    this.cells = new Map();
  }

  private keyFromCoord(coord: Coord): string {
    this.assertInBounds(coord, "SparseWorld.keyFromCoord");
    // Simple join; you can optimize later if needed
    return coord.join(",");
  }

  get(coord: Coord): T | undefined {
    const key = this.keyFromCoord(coord);
    return this.cells.get(key);
  }

  set(coord: Coord, value: T): void {
    const key = this.keyFromCoord(coord);
    this.cells.set(key, value);
  }

  has(coord: Coord): boolean {
    const key = this.keyFromCoord(coord);
    return this.cells.has(key);
  }

  delete(coord: Coord): void {
    const key = this.keyFromCoord(coord);
    this.cells.delete(key);
  }

  clear(): void {
    this.cells.clear();
  }

  forEach(fn: (value: T, coord: Coord) => void): void {
    for (const [key, value] of this.cells) {
      const coord = key.split(",").map(Number);
      fn(value, coord);
    }
  }
}