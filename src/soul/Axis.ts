import { CascadeCounter } from "./Counter";
import { posMod, clamp } from "../utils/MiscUtils";

import {
  assertSafeIntegerInRangeInclusive,
  assertSafeInteger,
} from "../utils/AssertUtils";

function assertValidAxis(fn: string, counter: CascadeCounter, axis: number) {
  assertSafeIntegerInRangeInclusive(fn, "axis", axis, 0, counter.size - 1);
}

export function setAxis(counter: CascadeCounter, axis: number, value: number): void {
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
  const next = clamp(value, 0, base - 1);

  if (next !== current) {
    counter.setAt(axis, next);
  }
}

export function offsetAxis(counter: CascadeCounter, axis: number, delta: number): void {
  assertSafeInteger("offsetAxis", "delta", delta);
  if (delta === 0) return;

  setAxis(counter, axis, counter.getAt(axis) + delta);
}

export function offsetAxisClamped(counter: CascadeCounter, axis: number, delta: number): void {
  assertSafeInteger("offsetAxisClamped", "delta", delta);
  if (delta === 0) return;

  setAxisClamped(counter, axis, counter.getAt(axis) + delta);
}
