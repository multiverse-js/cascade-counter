import type { BaseRules } from "../core/types";

export type SafePositiveInteger = number & { __brand: "SafePositiveInteger" };

export function assertSafeInteger(fn: string, param: string, value: number): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fn}(): '${param}' must be a safe integer (got ${value}).`);
  }
}

export function assertPositive(fn: string, param: string, value: number): asserts value is number {
  if (value <= 0) {
    throw new RangeError(`${fn}(): '${param}' must be positive (got ${value}).`);
  }
}

export function assertNonNegative(fn: string, param: string, value: number): asserts value is number {
  if (value < 0) {
    throw new RangeError(`${fn}(): '${param}' cannot be negative (got ${value}).`);
  }
}

export function assertGreaterThanOrEqual(fn: string, param: string, value: number, min: number): asserts value is number {
  if (value < min) {
    throw new RangeError(`${fn}(): '${param}' must be greater than or equal to ${min} (got ${value}).`);
  }
}

export function assertGreaterThan(fn: string, param: string, value: number, min: number): asserts value is number {
  if (value <= min) {
    throw new RangeError(`${fn}(): '${param}' must be greater than ${min} (got ${value}).`);
  }
}

export function assertLessThanOrEqual(fn: string, param: string, value: number, max: number): asserts value is number {
  if (value > max) {
    throw new RangeError(`${fn}(): '${param}' must be less than or equal to ${max} (got ${value}).`);
  }
}

export function assertLessThan(fn: string, param: string, value: number, max: number): asserts value is number {
  if (value >= max) {
    throw new RangeError(`${fn}(): '${param}' must be less than ${max} (got ${value}).`);
  }
}

export function assertInRangeInclusive(fn: string, param: string, value: number, min: number, max: number): asserts value is number {
  if (value < min || value > max) {
    throw new RangeError(`${fn}(): '${param}' must be in [${min}, ${max}] (got ${value}).`);
  }
}

export function assertInRangeExclusive(fn: string, param: string, value: number, min: number, max: number): asserts value is number {
  if (value <= min || value >= max) {
    throw new RangeError(`${fn}(): '${param}' must be in (${min}, ${max}) (got ${value}).`);
  }
}

export function assertEquals<T>(fn: string, param: string, value: T, expected: T): asserts value is T {
  if (value !== expected) {
    throw new Error(`${fn}(): '${param}' must be ${String(expected)} (got ${String(value)}).`);
  }
}

export function assertNotEquals<T>(fn: string, param: string, value: T, unexpected: T): asserts value is T {
  if (value === unexpected) {
    throw new Error(`${fn}(): '${param}' must not be ${String(unexpected)}.`);
  }
}

export function isSafePositiveInteger(x: number): boolean {
  return Number.isSafeInteger(x) && x >= 1;
}

export function assertSafePositiveInteger(fn: string, param: string, value: number): asserts value is SafePositiveInteger {
  assertSafeInteger(fn, param, value);
  assertPositive(fn, param, value);
}

export function assertSafeNonNegativeInteger(fn: string, param: string, value: number): asserts value is number {
  assertSafeInteger(fn, param, value);
  assertNonNegative(fn, param, value);
}

export function assertSafeIntegerInRangeInclusive(fn: string, param: string, value: number, min: number, max: number): asserts value is number {
  assertSafeInteger(fn, param, value);
  assertInRangeInclusive(fn, param, value, min, max);
}

export function assertBaseRuleValid(fn: string, index: string | number, rule: BaseRules) {
  if (typeof rule === "number") {
    if (!Number.isSafeInteger(rule) || rule < 1) {
      throw new TypeError(`${fn}(): '${index}' must be an integer ≥1`);
    }
  } else if (typeof rule !== "function") {
    throw new TypeError(`${fn}(): '${index}' must be a number or a function`);
  }
}