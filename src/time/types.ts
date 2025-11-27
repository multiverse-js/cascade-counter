export type TimelineEntry<Snapshot, Patch = Snapshot> = {
  index: number;
  snapshot?: Snapshot;  // full snapshot (for checkpoints / caching)
  patch?: Patch;        // patch from previous
  label?: string;
  timestamp: number;
}

export type TimelineMode = "full" | "patch" | "hybrid";

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

export type ScalarPatch<T> = {
  readonly prev: T | undefined;
  readonly next: T | undefined;
}

export type PatchDirection = "forward" | "backward";

export interface Action<T extends string = string> {
  type: T;
  payload?: unknown;
}

export type TimelineAction =
  | Action<"moveToFirst">
  | Action<"moveToPresent">
  | Action<"stepBackward">
  | Action<"stepForward">;