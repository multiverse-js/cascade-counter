import type { Coord, WorldOptions } from "./types";
import { BaseWorld } from "./World";

export class DenseWorld<T> extends BaseWorld<T> {
  private data: T[];
  private readonly defaultValue: T | undefined;

  constructor(options: WorldOptions<T>) {
    super({ ...options, backend: "dense" });

    this.defaultValue = options.defaultValue;
    this.data = new Array<T>(this.size);

    if (this.defaultValue !== undefined) {
      this.data.fill(this.defaultValue);
    }
  }

  get(coord: Coord): T | undefined {
    const index = this.toIndex(coord);
    if (index < 0) return undefined; // non-strict case
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

  toString(cellPadding = "", rowSeparator = "\n") {
    let out = "";

    if (this.bounds.length === 1) {
      const width = this.bounds[0];

      for (let x = 0; x < width; x++) {
        const cell = this.get([x]);
        out += (cell === this.defaultValue
          ? ` ${this.defaultValue} `
          : ` ${cell}${cellPadding}`
        );
      }
    } else if (this.bounds.length === 2) {
      const [width, height] = this.bounds;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cell = this.get([x, y]);
          out += (cell === this.defaultValue
            ? ` ${this.defaultValue} `
            : `${cell}${cellPadding}`
          );
        }
        out += rowSeparator;
      }
    } else {
      throw new Error("DenseWorld.print(): Cannot print world greater than 2 dimensions");
    }
    return out;
  }

  // get values() {
  //   return this.data;
  // }
}