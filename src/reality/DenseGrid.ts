import { StringRenderable } from "../soul/types";
import type { Coord, GridOptions } from "./types";
import { BaseGrid } from "./Grid";

export class DenseGrid<T> extends BaseGrid<T> {
  private cells: T[];
  readonly defaultValue: T | undefined;

  constructor(options: GridOptions<T>) {
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

  static gridToString<T extends StringRenderable>(
    cells: ReadonlyArray<T>,
    columns: number,
    rows: number,
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

    const expected = columns * rows;

    if (cells.length !== expected) {
      throw new Error(
        `gridToString(): expected '${expected}' cells in the grid, got ${cells.length}`
      );
    }

    let out = "";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const raw = cells[y * columns + x];

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

  gridToString(
    this: DenseGrid<StringRenderable>,
    options: {
      cellPadding?: string;
      rowSeparator?: string;
    } = {}
  ): string {
    const [columns, rows] = this.bounds;

    return DenseGrid.gridToString(this.cells, columns, rows, {
      defaultValue: this.defaultValue,
      ...options
    });
  }
}