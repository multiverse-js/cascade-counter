import { StringRenderable } from "../soul/types";
import type { Coord, WorldOptions } from "./types";
import { BaseWorld } from "./World";

export class DenseWorld<T> extends BaseWorld<T> {
  private cells: T[];
  readonly defaultValue: T | undefined;

  constructor(options: WorldOptions<T>) {
    super({ ...options, backend: "dense" });

    this.cells = new Array<T>(this.size);
    this.defaultValue = options.defaultValue;

    if (this.defaultValue !== undefined) {
      this.cells.fill(this.defaultValue);
    }
  }

  get(coord: Coord): T | undefined {
    const index = this.toIndex(coord);
    if (index < 0) return this.defaultValue; // non-strict case
    return this.cells[index];
  }

  set(coord: Coord, value: T): void {
    const index = this.toIndex(coord);
    if (index < 0) return;
    this.cells[index] = value;
  }

  // In dense worlds, "has" means "in-bounds", not "non-default".
  has(coord: Coord): boolean {
    const index = this.toIndex(coord);
    if (index < 0) return false;
    return true;
  }

  delete(coord: Coord): void {
    const index = this.toIndex(coord);
    if (index < 0) return;
    if (this.defaultValue !== undefined) {
      this.cells[index] = this.defaultValue;
    }
  }

  clear(): void {
    if (this.defaultValue !== undefined) {
      this.cells.fill(this.defaultValue);
    } else {
      this.cells = new Array<T>(this.size);
    }
  }

  forEach(fn: (value: T, coord: Coord) => void): void {
    for (let index = 0; index < this.size; index++) {
      const value = this.cells[index];
      const coord = this.fromIndex(index);
      fn(value, coord);
    }
  }

  isEmpty(coord: Coord): boolean {
    return this.get(coord) === this.defaultValue;
  }

  toArray(): T[] {
    return this.cells.slice();
  }

  loadFromArray(cells: ReadonlyArray<T>): void {
    if (cells.length !== this.size) {
      throw new Error(
        `DenseWorld.loadFromArray(): expected ${this.size} cells, got ${cells.length}`
      );
    }
    for (let i = 0; i < this.size; i++) {
      this.cells[i] = cells[i]!;
    }
  }
}

export function gridToString<T extends StringRenderable>(
  cells: ReadonlyArray<T>,
  width: number,
  height: number,
  options: {
    defaultValue?: T;
    cellPadding?: string;
    rowSeparator?: string;
  } = {}
): string {
  const {
    defaultValue,
    cellPadding = "",
    rowSeparator = "\n",
  } = options;

  const expected = width * height;

  if (cells.length !== expected) {
    throw new Error(
      `gridToString(): expected '${expected}' cells in the grid, got ${cells.length}`
    );
  }

  let out = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const raw = cells[y * width + x];

      if (defaultValue !== undefined && raw === defaultValue) {
        out += ` ${String(defaultValue)} `;
      } else {
        out += `${String(raw)}${cellPadding}`;
      }
    }
    out += rowSeparator;
  }

  return out;
}