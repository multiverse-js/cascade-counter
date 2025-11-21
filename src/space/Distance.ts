import { assertEquals } from "../utils/AssertUtils";
import { Coord } from "./types";

export function manhattan(a: Coord, b: Coord): number {
  assertEquals("manhattan", "a.length", a.length, b.length);

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum;
}

export function euclidean(a: Coord, b: Coord): number {
  assertEquals("euclidean", "a.length", a.length, b.length);

  return Math.sqrt(euclideanSquared(a, b));
}

export function euclideanSquared(a: Coord, b: Coord): number {
  assertEquals("euclidean", "a.length", a.length, b.length);

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

export function chebyshev(a: Coord, b: Coord): number {
  assertEquals("chebyshev", "a.length", a.length, b.length);

  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i]);
    if (diff > max) {
      max = diff;
    }
  }
  return max;
}

export function hamming(a: Coord, b: Coord): number {
  assertEquals("hamming", "a.length", a.length, b.length);

  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      count++;
    }
  }
  return count;
}