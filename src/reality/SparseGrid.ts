import type { Coord, GridOptions } from "./types";
import { BaseGrid } from "./Grid";

export class SparseGrid<T> extends BaseGrid<T> {
  private readonly cells: Map<string, T>;

  constructor(options: GridOptions<T>) {
    super({ ...options, backend: "sparse" });
    this.cells = new Map<string, T>();
  }

  private keyFromCoord(coord: Coord): string {
    this.assertInBounds(coord, "SparseGrid.keyFromCoord");
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