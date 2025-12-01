import {
  CellPatch2D,
  CellPatch3D,
  GridPatch2D,
  GridPatch3D,
  PatchDirection,
  ScalarPatch
} from "./types";

export function computeGridPatch2D<T>(
  prevCells: ReadonlyArray<T>,
  nextCells: ReadonlyArray<T>,
  width: number,
  height: number
): GridPatch2D<T> {
  if (prevCells.length !== nextCells.length) {
    throw new Error(
      `patch2DArray(): prev and next must have same length (got ${prevCells.length} vs ${nextCells.length})`
    );
  }

  const expectedSize = width * height;
  if (prevCells.length !== expectedSize) {
    throw new Error(
      `patch2DArray(): width*height = ${expectedSize} does not match array length = ${prevCells.length}`
    );
  }

  // If arrays are reference-equal, no need to scan
  if (prevCells === nextCells) return [];

  const patches: CellPatch2D<T>[] = [];

  for (let i = 0; i < expectedSize; i++) {
    const prev = prevCells[i];
    const next = nextCells[i];

    if (prev !== next) {
      const x = i % width;
      const y = (i / width) | 0; // faster floor
      patches.push({ x, y, prev, next });
    }
  }

  return patches;
}

export function computeGridPatch3D<T>(
  prevCells: ReadonlyArray<T>,
  nextCells: ReadonlyArray<T>,
  width: number,
  height: number,
  depth: number
): GridPatch3D<T> {
  if (prevCells.length !== nextCells.length) {
    throw new Error(
      `computeGridPatch3D(): prev and next must have same length (got ${prevCells.length} vs ${nextCells.length})`
    );
  }

  const expectedSize = width * height * depth;
  if (prevCells.length !== expectedSize) {
    throw new Error(
      `computeGridPatch3D(): width*height*depth = ${expectedSize} does not match array length = ${prevCells.length}`
    );
  }

  // If arrays are reference-equal, no need to scan
  if (prevCells === nextCells) return [];

  const patches: CellPatch3D<T>[] = [];

  for (let i = 0; i < expectedSize; i++) {
    const prev = prevCells[i];
    const next = nextCells[i];
    if (prev !== next) {
      const layerSize = width * height;
      const z = (i / layerSize) | 0;
      const rem = i - z * layerSize;
      const y = (rem / width) | 0;
      const x = rem - y * width;
      patches.push({ x, y, z, prev, next });
    }
  }

  return patches;
}

export function computeScalarPatch<T>(
  prev: T | undefined,
  next: T | undefined
): ScalarPatch<T> | undefined {
  if (prev === next) return undefined;
  return { prev, next };
}

export function applyGridPatch2D<T>(
  baseCells: ReadonlyArray<T>,
  cellsPatch: GridPatch2D<T>,
  width: number,
  dir: PatchDirection = "forward"
): ReadonlyArray<T> {
  const len = cellsPatch.length;
  if (len === 0) return baseCells;

  const cells = baseCells.slice();

  if (dir === "forward") {
    for (let i = 0; i < len; i++) {
      const cell = cellsPatch[i];
      const index = cell.y * width + cell.x;
      cells[index] = cell.next;
    }
  } else {
    for (let i = 0; i < len; i++) {
      const cell = cellsPatch[i];
      const index = cell.y * width + cell.x;
      cells[index] = cell.prev;
    }
  }

  return cells;
}

export function applyGridPatch3D<T>(
  baseCells: ReadonlyArray<T>,
  cellsPatch: GridPatch3D<T>,
  width: number,
  height: number,
  dir: PatchDirection = "forward"
): ReadonlyArray<T> {
  if (cellsPatch.length === 0) {
    // No changes: you can safely reuse the base reference.
    return baseCells;
  }

  const cells = baseCells.slice();
  const layerSize = width * height;

  if (dir === "forward") {
    for (const cell of cellsPatch) {
      const index = cell.z * layerSize + cell.y * width + cell.x;
      cells[index] = cell.next;
    }
  } else {
    for (const cell of cellsPatch) {
      const index = cell.z * layerSize + cell.y * width + cell.x;
      cells[index] = cell.prev;
    }
  }

  return cells;
}

export function applyScalarPatch<T>(
  base: T,
  patch: ScalarPatch<T> | undefined,
  dir: PatchDirection = "forward"
): T {
  if (!patch) return base;

  const value = dir === "forward" ? patch.next : patch.prev;

  // Fallback to base if patch value is undefined
  return value === undefined ? base : value;
};