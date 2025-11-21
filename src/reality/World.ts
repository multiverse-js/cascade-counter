import type {
  Coord,
  Bounds,
  WorldOptions
} from "./types";

/**
 * A generic N-dimensional state container.
 *
 * World is responsible for:
 * - Storing values at coordinates
 * - Knowing its own bounds
 * - Mapping between coord <-> linear index
 */
export interface World<T> {
  readonly dimensions: number;
  readonly bounds: Bounds;
  readonly size: number; // total capacity for dense; upper bound for sparse

  /** Returns value at coord, or undefined if empty / out-of-bounds. */
  get(coord: Coord): T | undefined;

  /** Sets value at coord. May throw if out-of-bounds in strict mode. */
  set(coord: Coord, value: T): void;

  /** True iff there is a stored value at coord (sparse) or in-bounds (dense). */
  has(coord: Coord): boolean;

  /** Removes value at coord (sparse); for dense, typically sets to defaultValue. */
  delete(coord: Coord): void;

  /** Clears all stored values. */
  clear(): void;

  /** Iterates over all stored values (dense: all cells, sparse: non-empty cells). */
  forEach(fn: (value: T, coord: Coord) => void): void;

  /** Coordinate → linear index (0..size-1). */
  toIndex(coord: Coord): number;

  /** Linear index → coordinate. */
  fromIndex(index: number): Coord;

  //get values(): T;
}

/**
 * Base class providing shared indexing logic & bounds checks.
 * Concrete subclasses only need to implement storage operations.
 */
export abstract class BaseWorld<T> implements World<T> {
  readonly dimensions: number;
  readonly bounds: Bounds;
  readonly size: number;
  protected readonly strides: ReadonlyArray<number>;
  protected readonly strictBounds: boolean;

  constructor(options: WorldOptions<T>) {
    const {
      bounds,
      strictBounds = true,
    } = options;

    if (!bounds.length) {
      throw new Error("World: bounds must be a non-empty array");
    }
    this.bounds = [...bounds];
    this.dimensions = bounds.length;
    this.strides = computeStrides(bounds);
    this.size = bounds.reduce((acc, b) => acc * b, 1);
    this.strictBounds = strictBounds;
  }

  drawLine(line: Coord[], value: T) {
    for (const [x, y] of line) {
      this.set([x, y], value);
    }
  }

  toIndex(coord: Coord): number {
    if (coord.length !== this.dimensions) {
      throw new Error(
        `World.toIndex(): coord dimension mismatch (expected ${this.dimensions}, got ${coord.length})`
      );
    }
    let idx = 0;
    for (let i = 0; i < this.dimensions; i++) {
      const c = coord[i];
      const bound = this.bounds[i];
      if (c < 0 || c >= bound) {
        if (this.strictBounds) {
          throw new RangeError(`World.toIndex(): coord[${i}] out of bounds (got ${c}, range 0..${bound - 1})`);
        }
        return -1;
      }
      idx += c * this.strides[i];
    }
    return idx;
  }

  fromIndex(index: number): Coord {
    if (index < 0 || index >= this.size) {
      throw new RangeError(
        `World.fromIndex(): index ${index} out of range (0..${this.size - 1})`
      );
    }
    const coord = new Array<number>(this.dimensions).fill(0);
    let r = index;
    for (let i = this.dimensions - 1; i >= 0; i--) {
      const stride = this.strides[i];
      coord[i] = Math.floor(r / stride) % this.bounds[i];
      r -= coord[i] * stride;
    }
    return coord;
  }

  inBounds(coord: Coord): boolean {
    if (coord.length !== this.dimensions) return false;

    for (let i = 0; i < this.dimensions; i++) {
      const c = coord[i];
      if (c < 0 || c >= this.bounds[i]) {
        return false;
      }
    }
    return true;
  }

  protected assertInBounds(coord: Coord, fn = "World.assertInBounds"): void {
    if (!this.inBounds(coord)) {
      throw new RangeError(
        `${fn}(): coord '${coord}' out of bounds (must be within ${this.bounds})`
      );
    }
  }

  abstract get(coord: Coord): T | undefined;
  abstract set(coord: Coord, value: T): void;
  abstract has(coord: Coord): boolean;
  abstract delete(coord: Coord): void;
  abstract clear(): void;
  abstract forEach(fn: (value: T, coord: Coord) => void): void;
  //abstract get values(): T;
}

/** Compute row-major strides: [1, b0, b0*b1, ...] */
function computeStrides(bounds: Bounds): ReadonlyArray<number> {
  const strides = new Array(bounds.length).fill(1);
  for (let i = 1; i < bounds.length; i++) {
    strides[i] = strides[i - 1] * bounds[i - 1];
  }
  return strides;
}