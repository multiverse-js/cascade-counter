//neighbors
//*iterateAlongRay
//_dfsFill
//_bfsFill

//findClosest
//raycast
//getLineCoords
//floodFill
//hasLine
//isFull

import { hasNonZeroValue } from "../core/MiscUtils";

import type {
  Coord,
  CoordPredicate,
  CoordFn,
  DistanceFn
} from "./types";

import {
  assertSafePositiveInteger,
  assertSafeNonNegativeInteger,
  assertGreaterThan,
  assertEquals
} from "../core/AssertUtils";

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

  let rolledOver = false;

  do {
    if (!predicate(coord)) {
      return false;
    }
    let i = 0;
    while (i < numDimensions) {
      coord[i]++;
      if (coord[i] < bases[i]) {
        break;
      }
      coord[i] = 0;
      i++;
    }
    rolledOver = (i === numDimensions);

  } while (!rolledOver);

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
  assertSafePositiveInteger("hasLine", "length", length);
  if (length <= 0) return true;
  assertEquals("hasLine", "direction.length", direction.length, start.length);

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
  inBounds: CoordPredicate = () => true
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
  visit: CoordFn
): void {
  const queue: Coord[] = [[...start]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift() as Coord;
    const key = _encodeCoord(current);

    if (visited.has(key)) continue;
    visited.add(key);

    if (!isFillable(current)) continue;

    visit(current);

    const adj = neighbors(current);
    for (const n of adj) {
      const nk = _encodeCoord(n);
      if (!visited.has(nk)) {
        queue.push([...n]);
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
    iterating = _incrementCoord(coord, bases, dimensions);
  }

  return closest;
}

const _encodeCoord = (c: Coord) => c.join(",");

/**
 * Returns:
 *   true  → successfully incremented
 *   false → rolled over all dimensions
 */
const _incrementCoord = (coord: number[], bases: ReadonlyArray<number>, dimensions: number): boolean => {
  for (let i = 0; i < dimensions; i++) {
    coord[i]++;
    if (coord[i] < bases[i]) {
      return true;
    }
    coord[i] = 0;
  }
  return false;
};