import { CascadeCounter } from "../core/Counter";
import { Coord } from "./types";

import {
  assertSafeIntegerInRangeInclusive,
  assertSafePositiveInteger,
  assertEquals,
} from "../core/AssertUtils";

/**
 * Drop the CascadeCounter coordinate along a given axis using ND gravity.
 *
 * @param counter    The CascadeCounter (its digits are the current coordinate)
 * @param axis       Axis index to apply gravity along
 * @param direction  Gravity direction: +1 (down/forward) or -1 (up/backward)
 * @param isBlocked  Predicate returning true if a coordinate is occupied
 * @param basesOpt   Optional explicit bases array. If omitted, bases are derived from counter.getBaseAt().
 *
 * @returns The final resting coordinate, or null if the starting cell is blocked.
 */
export function drop(
  counter: CascadeCounter,
  axis: number,
  direction: 1 | -1,
  isBlocked: (coord: Array<number>) => boolean,
  bases?: ReadonlyArray<number>
): Coord | null {
  const size = counter.size;

  // If explicit bases provided, validate length
  if (bases) {
    assertEquals("dropAlongAxis", "bases.length", bases.length, size);
    assertSafePositiveInteger("dropAlongAxis", "bases[dimension]", bases[axis]);
  } else {
    // Derive bases if not provided
    bases = counter.resolveBases();
  }
  assertSafeIntegerInRangeInclusive("dropAlongAxis", "dimension", axis, 0, bases.length - 1);

  const target = dropArray(
    counter.values,
    axis,
    direction,
    bases,
    isBlocked
  );

  if (target) {
    counter.set(target);
  }
  return target;
}

/**
 * Drop along a given axis with "gravity" in one direction
 * until you hit the last free cell.
 *
 * @param start      Starting coordinate (e.g. top of a column).
 * @param axis       Axis index to apply gravity along.
 * @param direction  Gravity direction: +1 (increasing index) or -1 (decreasing).
 * @param bases      Per-axis sizes (e.g. [width, height, depth, ...]).
 * @param isBlocked  Predicate: true if a cell is occupied / blocked.
 *
 * @returns The last free cell along that axis, or null if none available
 *          (e.g. starting cell is blocked).
 */
export function dropArray(
  start: Coord,
  axis: number,
  direction: 1 | -1,
  bases: ReadonlyArray<number>,
  isBlocked: (coord: Array<number>) => boolean
): Coord | null {
  let current = [...start];

  // If starting cell is blocked, no valid drop target.
  if (isBlocked(current)) return null;

  const maxIndex = bases[axis] - 1;
  let nextIndex = current[axis] + direction;

  while (nextIndex >= 0 && nextIndex <= maxIndex) {
    const next = [...current];
    next[axis] = nextIndex;

    if (isBlocked(next)) break;

    // Valid + not blocked → fall one step
    current = next;
    nextIndex = current[axis] + direction;
  }

  return current;
}
