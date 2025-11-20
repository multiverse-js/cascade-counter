import { Coord } from "./types";

/**
 * Returns all ND directions in {-1, 0, +1}^N except the zero vector.
 * Useful for adjacency, neighborhood scans, and full symmetric line checking.
 */
export function generateAllVectors(dim: number): Coord[] {
  const dirs: Coord[] = [];

  const recurse = (partial: number[]) => {
    if (partial.length === dim) {
      // Skip the all-zero direction
      if (partial.some(v => v !== 0)) {
        dirs.push([...partial] as Coord);
      }
      return;
    }
    for (const v of [-1, 0, 1]) {
      recurse([...partial, v]);
    }
  }
  recurse([]);

  return dirs;
}

/**
 * Generates all ND directions where each axis is either 0 or +1,
 * excluding the all-zero vector.
 *
 * This yields unique forward directions, useful for eliminating duplicates
 * when scanning lines or rays.
 */
export function generatePositiveVectors(dim: number): Coord[] {
  const dirs: Coord[] = [];
  const total = 1 << dim; // 2^dim

  for (let mask = 1; mask < total; mask++) {
    const vec = Array(dim).fill(0);

    for (let axis = 0; axis < dim; axis++) {
      if (mask & (1 << axis)) {
        vec[axis] = 1; // positive axis movement
      }
    }
    dirs.push(vec as Coord);
  }

  return dirs;
}

/**
 * Generates only the ND directions whose first non-zero coordinate is +1.
 *
 * This eliminates opposite duplicates while allowing diagonals such as [1,-1],
 * matching Connect-Four style directional scanning.
 */
export function generateQuadrantVectors(dim: number): Coord[] {
  const dirs: Coord[] = [];

  const recurse = (partial: number[]) => {
    if (partial.length === dim) {
      // skip all-zero
      if (partial.every(v => v === 0)) return;

      // include only if first non-zero axis is +1
      const first = partial.find(v => v !== 0);

      if (first === 1) {
        dirs.push([...partial] as Coord);
      }
      return;
    }
    for (const v of [-1, 0, 1]) {
      recurse([...partial, v]);
    }
  }
  recurse([]);

  return dirs;
}