import type { GridOptions, GridBackend } from "./types";
import { BaseGrid } from "./Grid";
import { DenseGrid } from "./DenseGrid";
import { SparseGrid } from "./SparseGrid";

export * from "./types";
export * from "./Grid";
export * from "./DenseGrid";
export * from "./SparseGrid";

export function createWorld<T>(options: GridOptions<T>): BaseGrid<T> {
  const backend: GridBackend = options.backend ?? "dense";

  if (backend === "dense") {
    return new DenseGrid<T>(options);
  }
  return new SparseGrid<T>(options);
}
