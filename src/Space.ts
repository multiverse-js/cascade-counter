import { CascadeCounter } from "./core/Counter";

import {
  assertSafeNonNegativeInteger,
  assertSafeIntegerInRangeInclusive,
  assertSafePositiveInteger,
  assertEquals
} from "./core/AssertUtils";

/**
 * Increment a specific axis with wrap-around,
 * without causing cascade into higher axes.
 *
 * @param counter  The CascadeCounter instance.
 * @param dimension      The axis index to increment.
 * @param step     The amount to increment.
 */
export function incrementAxis(counter: CascadeCounter, dimension: number, step = 1): void {
  assertSafeNonNegativeInteger("incrementAxis", "dimension", dimension);

  if (step === 0) return;
  if (step < 0) decrementAxis(counter, dimension, -step);

  const values = [...counter.values];
  const base = counter.getBaseAt(dimension);

  values[dimension] = (values[dimension] + step) % base;

  counter.set(values);
}


/**
 * Decrement a specific axis with wrap-around,
 * without causing cascade into higher axes.
 *
 * @param counter  The CascadeCounter instance.
 * @param dimension      The axis index to decrement.
 * @param step     The amount to decrement.
 */
export function decrementAxis(counter: CascadeCounter, dimension: number, step = 1): void {
  assertSafeNonNegativeInteger("decrementAxis", "dimension", dimension);

  if (step === 0) return;
  if (step < 0) incrementAxis(counter, dimension, -step);

  const values = [...counter.values];
  const base = counter.getBaseAt(dimension);

  values[dimension] = (values[dimension] - step + base) % base;

  counter.set(values);
}

export function incrementAxisClamped(counter: CascadeCounter, dimension: number, step = 1): void {
  assertSafeNonNegativeInteger("incrementAxis", "dimension", dimension);

  if (step === 0) return;
  if (step < 0) decrementAxisClamped(counter, dimension, -step);

  const values = [...counter.values];
  const current = values[dimension];
  const max = counter.getBaseAt(dimension) - 1;

  let next = current + step;
  if (next > max) next = max;

  if (next !== current) {
    values[dimension] = next;
    counter.set(values);
  }
}

export function decrementAxisClamped(counter: CascadeCounter, dimension: number, step = 1): void {
  assertSafeNonNegativeInteger("incrementAxis", "dimension", dimension);

  if (step === 0) return;
  if (step < 0) incrementAxisClamped(counter, dimension, -step);

  const values = [...counter.values];
  const current = values[dimension];

  let next = current - step;
  if (next < 0) next = 0;

  if (next !== current) {
    values[dimension] = next;
    counter.set(values);
  }
}

export type Coord = ReadonlyArray<number>;
export type IsBlocked = (coord: Coord) => boolean;

/**
 * Drop the CascadeCounter coordinate along a given axis using ND gravity.
 *
 * @param counter    The CascadeCounter (its digits are the current coordinate)
 * @param dimension  Axis index to apply gravity along
 * @param direction  Gravity direction: +1 (down/forward) or -1 (up/backward)
 * @param isBlocked  Predicate returning true if a coordinate is occupied
 * @param basesOpt   Optional explicit bases array. If omitted, bases are derived from counter.getBaseAt().
 *
 * @returns The final resting coordinate, or null if the starting cell is blocked.
 */
export function dropAlongAxis(
  counter: CascadeCounter,
  dimension: number,
  direction: 1 | -1,
  isBlocked: IsBlocked,
  bases?: ReadonlyArray<number>
): Coord | null {
  const size = counter.size;

  // If explicit bases provided, validate length
  if (bases) {
    assertEquals("dropAlongAxis", "bases.length", bases.length, size);
    assertSafePositiveInteger("dropAlongAxis", "bases[dimension]", bases[dimension]);
  } else {
    // Derive bases if not provided
    bases = Array.from({ length: size }, (_, i) => counter.getBaseAt(i));
  }
  assertSafeIntegerInRangeInclusive("dropAlongAxis", "dimension", dimension, 0, bases.length - 1);

  const target = _dropAlongAxis(
    counter.values,
    dimension,
    direction,
    bases,
    isBlocked
  );

  if (target) counter.set(target);

  return target;
}

/**
 * Drop along a given axis with "gravity" in one direction
 * until you hit the last free cell.
 *
 * @param start      Starting coordinate (e.g. top of a column).
 * @param dimension  Axis index to apply gravity along.
 * @param direction  Gravity direction: +1 (increasing index) or -1 (decreasing).
 * @param bases      Per-axis sizes (e.g. [width, height, depth, ...]).
 * @param isBlocked  Predicate: true if a cell is occupied / blocked.
 *
 * @returns The last free cell along that axis, or null if none available
 *          (e.g. starting cell is blocked).
 */
function _dropAlongAxis(
  start: Coord,
  dimension: number,
  direction: 1 | -1,
  bases: ReadonlyArray<number>,
  isBlocked: IsBlocked
): Coord | null {
  let current = [...start];

  // If starting cell is blocked, no valid drop target.
  if (isBlocked(current)) return null;

  const maxIndex = bases[dimension] - 1;
  let nextIndex = current[dimension] + direction;

  while (nextIndex >= 0 && nextIndex <= maxIndex) {
    const next = [...current];
    next[dimension] = nextIndex;

    if (isBlocked(next)) break;

    // Valid + not blocked → fall one step
    current = next;
    nextIndex = current[dimension] + direction;
  }

  return current;
}

//TODO:
//neighbors
//isFull
//line
//raycast
