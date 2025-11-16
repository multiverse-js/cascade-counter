import { hasNonZeroValue } from "../core/MiscUtils";

import type {
  Coord,
  CoordPredicate,
  CoordFn,
  DistanceFn,
  Offset,
  NeighborhoodKind,
  FloodMode
} from "./types";

import {
  assertSafeNonNegativeInteger,
  assertGreaterThan,
  assertEquals
} from "../core/AssertUtils";

const _neighborOffsetCache = new Map<string, ReadonlyArray<Offset>>();

/**
 * Returns true iff every coordinate in the rectangular ND region
 * defined by `bases` satisfies `predicate`.
 *
 * Region: all coords c where 0 <= c[i] < bases[i] for each axis i.
 *
 * Note: `coord` passed to `predicate` is reused for performance;
 * do not store it, clone if you need to keep it.
 */
export function isFull(bases: ReadonlyArray<number>, predicate: CoordPredicate): boolean {
  assertGreaterThan("isFull", "bases.length", bases.length, 0);

  const numDimensions = bases.length;
  const coord = new Array<number>(numDimensions).fill(0);

  let i = 0;

  do {
    if (!predicate(coord)) {
      return false;
    }
    i = 0;
    while (i < numDimensions) {
      coord[i]++;
      if (coord[i] < bases[i]) {
        break;
      }
      coord[i] = 0;
      i++;
    }
  } while (i !== numDimensions);

  return true;
}

/**
 * Returns true iff there are at least `length` consecutive cells
 * along the line passing through `start` in ±`direction` that satisfy `matches`.
 *
 * Includes `start` itself in the count if it matches.
 *
 * Only up to `length - 1` steps are taken in each direction, since we don't
 * need to scan beyond the required run length.
 */
export function hasLine(
  start: Coord,
  direction: Coord,
  length: number,
  inBounds: CoordPredicate,
  matches: CoordPredicate
): boolean {
  assertEquals("hasLine", "direction.length", direction.length, start.length);

  if (!hasNonZeroValue(direction)) throw new Error("hasLine(): direction cannot be all zeros");
  if (length <= 0) return true;
  if (!matches(start)) return false;

  const numDimensions = start.length;
  let count = 1; // start already matched

  const stepDir = (sign: 1 | -1): boolean => {
    const cur = [...start];

    // We only need at most (length - 1) steps in this direction
    for (let step = 1; step < length; step++) {
      for (let i = 0; i < numDimensions; i++) {
        cur[i] = cur[i] + sign * direction[i];
      }
      if (!inBounds(cur) || !matches(cur)) {
        break;
      }
      count++;
      if (count >= length) {
        return true;
      }
    }
    return false;
  };

  if (stepDir(1)) return true;
  if (stepDir(-1)) return true;

  return count >= length;
}

/**
 * Returns the list of coordinates starting at `start` and stepping by `direction`
 * up to `maxSteps` steps (inclusive of start). If `inBounds` is provided,
 * stops early when a step goes out of bounds.
 *
 * Example (2D):
 *   start = [0,0], direction = [1,1], maxSteps = 3
 *   → [[0,0], [1,1], [2,2], [3,3]]
 */
export function getLineCoords(
  start: Coord,
  direction: Coord,
  maxSteps: number,
  inBounds: CoordPredicate = _alwaysTrue
): Coord[] {
  assertEquals("lineCoords", "direction.length", direction.length, start.length);
  assertSafeNonNegativeInteger("lineCoords", "maxSteps", maxSteps);

  const dims = start.length;
  const cur = [...start];
  const out: Coord[] = [[...cur]]; // include start

  for (let step = 0; step < maxSteps; step++) {
    for (let i = 0; i < dims; i++) {
      cur[i] = cur[i] + direction[i];
    }
    if (!inBounds(cur)) break;
    out.push([...cur]);
  }

  return out;
}

export function raycast(
  start: Coord,
  direction: Coord,
  inBounds: CoordPredicate,
  hitTest: CoordPredicate,
  maxSteps?: number, // undefined → unlimited
  stopOnHit = true
): Coord | null {
  assertEquals("raycast", "direction.length", direction.length, start.length);

  if (!hasNonZeroValue(direction)) {
    throw new Error("raycast(): direction cannot be all zeros (infinite loop).");
  }
  if (maxSteps !== undefined) {
    assertSafeNonNegativeInteger("raycast", "maxSteps", maxSteps);
  }

  const dimensions = start.length;
  const cur = [...start];

  let stepsRemaining = maxSteps ?? Number.POSITIVE_INFINITY;
  let firstHit: Coord | null = null;

  while (stepsRemaining > 0) {
    // Step once
    for (let i = 0; i < dimensions; i++) {
      cur[i] = cur[i] + direction[i];
    }
    if (!inBounds(cur)) {
      break;
    }
    if (hitTest(cur)) {
      if (stopOnHit) {
        return [...cur];
      }
      if (!firstHit) {
        firstHit = [...cur];
      }
    }
    stepsRemaining--;
  }

  return firstHit;
}

/**
 * Iterates along a ray starting at `start`, stepping by `direction`,
 * yielding each coordinate strictly after `start` until either:
 *   - out of bounds (inBounds returns false), or
 *   - maxSteps steps have been taken (if provided).
 *
 * 
 * @param start       Starting coordinate (not yielded)
 * @param direction   Step vector (must not be all zeros)
 * @param inBounds    Predicate determining if a coordinate is valid
 * @param maxSteps    Optional limit; if omitted, iterate until out of bounds
 *
 * @yields Coord   A new coordinate at each step
 */
export function* iterateAlongRay(
  start: Coord,
  direction: Coord,
  inBounds: CoordPredicate,
  maxSteps?: number
): Generator<Coord, void, void> {
  const dimensions = start.length;

  assertEquals("iterateAlongRay", "direction.length", direction.length, dimensions);
  if (maxSteps !== undefined) {
    assertSafeNonNegativeInteger("iterateAlongRay", "maxSteps", maxSteps);
  }
  if (!hasNonZeroValue(direction)) return;

  const cur = [...start];
  let step = 0;

  while (maxSteps === undefined || step < maxSteps) {
    step++;
    // Move one step
    for (let i = 0; i < dimensions; i++) {
      cur[i] = cur[i] + direction[i];
    }
    if (!inBounds(cur)) {
      return;
    }
    // Yield a **copy** so caller can store safely
    yield [...cur];
  }
}

/**
 * Breadth-first flood fill starting from `start`.
 *
 * - `neighbors(coord)` should return adjacent coordinates (e.g. 4- or 8-neighborhood).
 * - `isFillable(coord)` determines whether a cell should be part of the region.
 * - `visit(coord)` is called once per filled cell.
 *
 * Cells are visited at most once; simple string-keyed visited set is used.
 */
export function floodFill(
  start: Coord,
  neighbors: (coord: Coord) => ReadonlyArray<Coord>,
  isFillable: CoordPredicate,
  visit: CoordFn,
  mode: FloodMode = "bfs"
): void {
  const frontier: Coord[] = [[...start]];
  const visited = new Set<string>();

  while (frontier.length > 0) {
    // queue: FIFO
    // stack: LIFO
    const current = (mode === "bfs" ? frontier.shift() : frontier.pop()) as Coord;
    const key = _encodeCoord(current);

    if (visited.has(key)) continue;
    visited.add(key);
    if (!isFillable(current)) continue;

    visit(current);

    const adj = neighbors(current);
    for (const n of adj) {
      const nk = _encodeCoord(n);
      if (!visited.has(nk)) {
        frontier.push([...n]);
      }
    }
  }
}

/**
 * Finds the closest coordinate (to `origin`) in the ND rectangular region
 * defined by `bases` for which `predicate(coord)` is true.
 *
 * Uses `distance(a,b)` to rank candidates.
 * Returns a *fresh* Coord, or null if no match exists.
 */
export function findClosest(
  origin: Coord,
  bases: ReadonlyArray<number>,
  predicate: CoordPredicate,
  distance: DistanceFn
): Coord | null {
  const dimensions = bases.length;

  assertEquals("findClosest", "origin.length", origin.length, dimensions);

  const coord = new Array<number>(dimensions).fill(0);

  let closest: Coord | null = null;
  let shortestDist = Infinity;
  let iterating = true;

  while (iterating) {
    if (predicate(coord)) {
      const d = distance(origin, coord);
      if (d < shortestDist) {
        shortestDist = d;
        closest = [...coord];
      }
    }
    iterating = _incrementCoord(coord, bases);
  }

  return closest;
}

export function neighbors(
  coord: Coord,
  inBounds: CoordPredicate = _alwaysTrue,
  kind: NeighborhoodKind = "vonNeumann"
): Coord[] {
  const dimensions = coord.length;
  const offsets = _generateNeighborhoodOffsets(dimensions, kind);
  const result: Coord[] = [];

  for (const off of offsets) {
    const next: number[] = new Array(dimensions);
    for (let i = 0; i < dimensions; i++) {
      next[i] = coord[i] + off[i];
    }
    if (!inBounds(next)) continue;
    result.push(next);
  }

  return result;
}

export function isEqual(a: Coord, b: Coord): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * Calculates the bounding box of a list of coordinates.
 */
export function getBoundingBox(coords: Coord[]): { min: Coord; max: Coord } {
  const dimensions = coords[0].length;
  const min = new Array(dimensions).fill(Infinity);
  const max = new Array(dimensions).fill(-Infinity);

  for (const coord of coords) {
    for (let i = 0; i < dimensions; i++) {
      min[i] = Math.min(min[i], coord[i]);
      max[i] = Math.max(max[i], coord[i]);
    }
  }

  return { min, max };
}

/**
 * Transforms a coordinate by applying a linear transformation matrix.
 */
export function transformCoord(coord: Coord, matrix: readonly number[][]): Coord {
  const length = coord.length;
  const result = new Array(length).fill(0);

  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      result[i] += matrix[i][j] * coord[j];
    }
  }
  return result;
}

export function inBounds(coord: Coord, bounds: Coord): boolean {
  assertEquals("inBounds", "coord.length", coord.length, bounds.length);

  for (let i = 0; i < length; i++) {
    if (coord[i] < 0 || coord[i] >= bounds[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Transforms a coordinate by applying a linear transformation matrix.
 * Ensures that the transformed coordinate is within the bounds.
 */
export function transformCoordWithBounds(
  coord: Coord, 
  matrix: readonly number[][], 
  bounds: ReadonlyArray<number>
): Coord | null {
  const newCoord = transformCoord(coord, matrix);
  return inBounds(newCoord, bounds) ? newCoord : null;
}

/**
 * Sorts a list of coordinates lexicographically in ascending order.
 */
export function sortCoords(coords: Coord[]): Coord[] {
  return coords.sort((a, b) => {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return a[i] - b[i];
      }
    }
    return 0;
  });
}

const _encodeCoord = (c: Coord) => c.join(",");
const _alwaysTrue: CoordPredicate = () => true;

/**
 * Returns:
 *   true  → successfully incremented
 *   false → rolled over all dimensions
 */
const _incrementCoord = (coord: number[], bases: ReadonlyArray<number>): boolean => {
  const dimensions = bases.length;

  for (let i = 0; i < dimensions; i++) {
    coord[i]++;
    if (coord[i] < bases[i]) {
      return true;
    }
    coord[i] = 0;
  }
  return false;
}

function _generateNeighborhoodOffsets(dims: number, kind: NeighborhoodKind): ReadonlyArray<Offset> {
  const key = `${dims}:${kind}`;
  const cached = _neighborOffsetCache.get(key);
  if (cached) return cached;

  const offsets: number[][] = [];
  const cur = new Array<number>(dims).fill(0);

  const build = (idx: number) => {
    if (idx === dims) {
      // Skip zero vector
      let manhattan = 0;
      for (let i = 0; i < dims; i++) {
        manhattan += Math.abs(cur[i]);
      }
      if (manhattan === 0) return;

      if (kind === "vonNeumann") {
        if (manhattan === 1) {
          offsets.push([...cur]);  // orthogonal only
        }
      } else {
        offsets.push([...cur]);    // moore: all except zero
      }
      return;
    }

    for (let v = -1; v <= 1; v++) {
      cur[idx] = v;
      build(idx + 1);
    }
  }
  build(0);

  const frozen = offsets.map(o => Object.freeze([...o])) as ReadonlyArray<Offset>;
  _neighborOffsetCache.set(key, frozen);
  return frozen;
}