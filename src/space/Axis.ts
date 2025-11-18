import { CascadeCounter } from "../core/Counter";
import { Coord } from "./types";
import { posMod, clampToRange } from "../core/MiscUtils";

import {
  assertSafeIntegerInRangeInclusive,
  assertSafePositiveInteger,
  assertEquals,
  assertSafeInteger,
  assertSafeNonNegativeInteger
} from "../core/AssertUtils";

const assertValidAxis = (fn: string, counter: CascadeCounter, axis: number) => {
  assertSafeNonNegativeInteger(fn, "axis", axis);
  assertSafeIntegerInRangeInclusive(fn, "axis", axis, 0, counter.size - 1);
}

export function setAxis(counter: CascadeCounter, axis: number, value: number) {
  assertSafeInteger("setAxis", "value", value);
  assertValidAxis("setAxis", counter, axis);

  const base = counter.getBaseAt(axis);
  const current = counter.getAt(axis);
  const next = posMod(value, base);

  if (next !== current) {
    counter.setAt(axis, next);
  }
}

export function setAxisClamped(counter: CascadeCounter, axis: number, value: number): void {
  assertSafeInteger("setAxisClamped", "value", value);
  assertValidAxis("setAxisClamped", counter, axis);

  const base = counter.getBaseAt(axis);
  const current = counter.getAt(axis);
  const next = clampToRange(value, 0, base - 1);

  if (next !== current) {
    counter.setAt(axis, next);
  }
}

export function incrementAxis(counter: CascadeCounter, axis: number, delta = 1): void {
  assertSafeInteger("incrementAxis", "delta", delta);
  if (delta === 0) return;
  setAxis(counter, axis, counter.getAt(axis) + delta);
}

export function incrementAxisClamped(counter: CascadeCounter, axis: number, delta = 1) {
  assertSafeInteger("incrementAxisClamped", "delta", delta);
  if (delta === 0) return;
  setAxisClamped(counter, axis, counter.getAt(axis) + delta);
}

export function decrementAxis(counter: CascadeCounter, axis: number, delta = 1) {
  assertSafeInteger("decrementAxis", "delta", delta);
  if (delta === 0) return;
  setAxis(counter, axis, counter.getAt(axis) - delta);
}

export function decrementAxisClamped(counter: CascadeCounter, axis: number, delta = 1) {
  assertSafeInteger("decrementAxisClamped", "delta", delta);
  if (delta === 0) return;
  setAxisClamped(counter, axis, counter.getAt(axis) - delta);
}

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
export function dropAlongAxis(
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

  const target = dropArrayAlongAxis(
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
export function dropArrayAlongAxis(
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
