import { CascadeCounter } from "../core/Counter";
import { Coord, CoordPredicate } from "./types";

import {
  assertSafeNonNegativeInteger,
  assertSafeIntegerInRangeInclusive,
  assertSafePositiveInteger,
  assertEquals,
  assertSafeInteger
} from "../core/AssertUtils";

/**
 * Increment along a specific axis with wrap-around,
 * without causing cascade into higher axes.
 *
 * @param counter  The CascadeCounter instance.
 * @param axis     The axis index to increment.
 * @param delta    The amount to increment.
 */
export function increment(counter: CascadeCounter, axis: number, delta = 1): void {
  assertSafeNonNegativeInteger("incrementAxis", "dimension", axis);
  assertSafeInteger("incrementAxis", "delta", delta);

  if (delta === 0) return;
  if (delta < 0) decrement(counter, axis, -delta);

  const values = [...counter.values];
  const base = counter.getBaseAt(axis);

  values[axis] = (values[axis] + delta) % base;

  counter.set(values);
}


/**
 * Decrement along a specific axis with wrap-around,
 * without causing cascade into higher axes.
 *
 * @param counter  The CascadeCounter instance.
 * @param axis     The axis index to decrement.
 * @param delta    The amount to decrement.
 */
export function decrement(counter: CascadeCounter, axis: number, delta = 1): void {
  assertSafeNonNegativeInteger("decrementAxis", "dimension", axis);
  assertSafeInteger("decrementAxis", "delta", delta);

  if (delta === 0) return;
  if (delta < 0) increment(counter, axis, -delta);

  const values = [...counter.values];
  const base = counter.getBaseAt(axis);

  values[axis] = (values[axis] - delta + base) % base;

  counter.set(values);
}

export function incrementClamped(counter: CascadeCounter, axis: number, delta = 1): void {
  assertSafeNonNegativeInteger("incrementAxis", "dimension", axis);
  assertSafeInteger("incrementAxisClamped", "delta", delta);

  if (delta === 0) return;
  if (delta < 0) decrementClamped(counter, axis, -delta);

  const values = [...counter.values];
  const current = values[axis];
  const max = counter.getBaseAt(axis) - 1;

  let next = current + delta;
  if (next > max) next = max;

  if (next !== current) {
    values[axis] = next;
    counter.set(values);
  }
}

export function decrementClamped(counter: CascadeCounter, axis: number, delta = 1): void {
  assertSafeNonNegativeInteger("incrementAxis", "dimension", axis);
  assertSafeInteger("decrementAxisClamped", "delta", delta);

  if (delta === 0) return;
  if (delta < 0) incrementClamped(counter, axis, -delta);

  const values = [...counter.values];
  const current = values[axis];

  let next = current - delta;
  if (next < 0) next = 0;

  if (next !== current) {
    values[axis] = next;
    counter.set(values);
  }
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
export function drop(
  counter: CascadeCounter,
  axis: number,
  direction: 1 | -1,
  isBlocked: CoordPredicate,
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

  const target = _drop(
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
function _drop(
  start: Coord,
  axis: number,
  direction: 1 | -1,
  bases: ReadonlyArray<number>,
  isBlocked: CoordPredicate
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
