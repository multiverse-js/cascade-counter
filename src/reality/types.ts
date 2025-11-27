/** Coordinate in N-dimensional integer space. */
export type Coord = ReadonlyArray<number>;

/** Per-axis sizes for a bounded world, e.g. [width, height, depth]. */
export type Bounds = ReadonlyArray<number>;

export type GridBackend = "dense" | "sparse";

export interface GridOptions<T> {
  /** Size of each axis, e.g. [width, height] or [width, height, time]. */
  bounds: Bounds;

  /** Backend representation. Dense = flat array; sparse = Map. */
  backend?: GridBackend;

  /** Optional default value for dense worlds; sparse worlds treat "missing" as empty. */
  defaultValue: T;

  /**
   * Optional flag: if true, treat out-of-bounds access as an error.
   * If false, get() may return undefined instead of throwing.
   */
  strictBounds?: boolean;
}

export type CellPatch2D<T> = {
  readonly x: number;
  readonly y: number;
  readonly prev: T;
  readonly next: T;
}

export type CellPatch3D<T> = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly prev: T;
  readonly next: T;
}

export type GridPatch2D<T> = ReadonlyArray<CellPatch2D<T>>;

export type GridPatch3D<T> = ReadonlyArray<CellPatch3D<T>>;

export type PatchDirection = "forward" | "backward";

export type StringRenderable = {
  toString(): string
};