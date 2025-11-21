import type { WorldOptions, WorldBackendKind } from "./types";
import { World } from "./World";
import { DenseWorld } from "./DenseWorld";
import { SparseWorld } from "./SparseWorld";

export * from "./types";
export * from "./World";
export * from "./DenseWorld";
export * from "./SparseWorld";

export function createWorld<T>(options: WorldOptions<T>): World<T> {
  const backend: WorldBackendKind = options.backend ?? "dense";

  if (backend === "dense") {
    return new DenseWorld<T>(options);
  }
  return new SparseWorld<T>(options);
}
