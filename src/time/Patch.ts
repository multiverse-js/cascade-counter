import { Patch2D, Patch3D } from "./types";

export function computeGridPatch2D<T>(
  prev: ReadonlyArray<T>,
  next: ReadonlyArray<T>,
  width: number,
  height: number
): Patch2D<T>[] {
  if (prev.length !== next.length) {
    throw new Error(
      `patch2DArray: prev and next must have same length (got ${prev.length} vs ${next.length})`
    );
  }

  if (prev.length !== width * height) {
    throw new Error(
      `patch2DArray: width*height = ${width * height} does not match array length = ${prev.length}`
    );
  }

  const patches: Patch2D<T>[] = [];
  const length = prev.length;

  for (let i = 0; i < length; i++) {
    const prevValue = prev[i];
    const nextValue = next[i];

    if (prevValue !== nextValue) {
      const x = i % width;
      const y = Math.floor(i / width);

      patches.push({ x, y, value: nextValue });
    }
  }

  return patches;
}

export function computeGridPatch3D<T>(
  prev: ReadonlyArray<T>,
  next: ReadonlyArray<T>,
  width: number,
  height: number,
  depth: number
): Patch3D<T>[] {
  if (prev.length !== next.length) {
    throw new Error(
      `patch3DArray: prev and next must have same length (got ${prev.length} vs ${next.length})`
    );
  }

  const expectedSize = width * height * depth;
  if (prev.length !== expectedSize) {
    throw new Error(
      `patch3DArray: width*height*depth = ${expectedSize} does not match array length = ${prev.length}`
    );
  }

  const patches: Patch3D<T>[] = [];
  const length = prev.length;

  for (let index = 0; index < length; index++) {
    const prevValue = prev[index];
    const nextValue = next[index];

    if (prevValue !== nextValue) {
      const planeSize = width * height;

      const z = Math.floor(index / planeSize);
      const rem1 = index - z * planeSize;
      const y = Math.floor(rem1 / width);
      const x = rem1 % width;

      patches.push({ x, y, z, value: nextValue });
    }
  }

  return patches;
}

export function computeScalarPatch<T>(prev: T, next: T): T | undefined {
  return Object.is(prev, next) ? undefined : next;
}

export function applyGridPatch2D<T>(
  baseCells: ReadonlyArray<T>,
  cellsPatch: ReadonlyArray<Patch2D<T>>,
  width: number
): ReadonlyArray<T> {
  if (cellsPatch.length === 0) {
    // No changes: you can safely reuse the base reference.
    return baseCells;
  }

  const cells = baseCells.slice();

  for (const cell of cellsPatch) {
    const index = cell.y * width + cell.x;
    cells[index] = cell.value;
  }

  return cells;
}

export function applyGridPatch3D<T>(
  baseCells: ReadonlyArray<T>,
  cellsPatch: ReadonlyArray<Patch3D<T>>,
  width: number,
  height: number
): ReadonlyArray<T> {
  if (cellsPatch.length === 0) {
    // No changes: you can safely reuse the base reference.
    return baseCells;
  }

  const cells = baseCells.slice();
  const layerSize = width * height;

  for (const cell of cellsPatch) {
    const index = cell.z * layerSize + cell.y * width + cell.x;
    cells[index] = cell.value;
  }

  return cells;
}