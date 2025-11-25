import { StringRenderable } from "../soul/types";
import type { Coord, WorldOptions } from "./types";
import { BaseWorld } from "./World";

export class DenseWorld<T> extends BaseWorld<T> {
  private data: T[];
  readonly defaultValue: T;

  constructor(options: WorldOptions<T>) {
    super({ ...options, backend: "dense" });

    this.defaultValue = options.defaultValue;
    this.data = new Array<T>(this.size);

    if (this.defaultValue !== undefined) {
      this.data.fill(this.defaultValue);
    }
  }

  get(coord: Coord): T {
    const index = this.toIndex(coord);
    if (index < 0) return this.defaultValue; // non-strict case
    return this.data[index];
  }

  set(coord: Coord, value: T): void {
    const index = this.toIndex(coord);
    if (index < 0) return;
    this.data[index] = value;
  }

  has(coord: Coord): boolean {
    const index = this.toIndex(coord);
    if (index < 0) return false;
    // In dense worlds, "has" means "in-bounds", not "non-default".
    return true;
  }

  delete(coord: Coord): void {
    const index = this.toIndex(coord);
    if (index < 0) return;
    if (this.defaultValue !== undefined) {
      this.data[index] = this.defaultValue;
    } else {
      // @ts-expect-error assigning undefined to T
      this.data[index] = undefined;
    }
  }

  clear(): void {
    if (this.defaultValue !== undefined) {
      this.data.fill(this.defaultValue);
    } else {
      this.data = new Array<T>(this.size);
    }
  }

  forEach(fn: (value: T, coord: Coord) => void): void {
    for (let index = 0; index < this.size; index++) {
      const value = this.data[index];
      const coord = this.fromIndex(index);
      fn(value, coord);
    }
  }

  isEmpty(coord: Coord): boolean {
    return this.get(coord) === this.defaultValue;
  }

  get cells(): T[] {
    return this.data.slice();
  }

  static toStringFromData2D<T extends StringRenderable>(
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
        `DenseWorld.toStringFromData: expected ${expected} cells for 2D world, got ${cells.length}`
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
}