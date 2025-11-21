import type { NonEmptyReadonlyArray } from "../core/types";

export const clampToRange = (v: number, min: number, max: number): number => v < min ? min : v > max ? max : v;

export const posMod = (a: number, m: number) => ((a % m) + m) % m;

export const arraysEqual = <T>(a: readonly T[], b: readonly T[]): boolean => {
  if (a === b) return true;
  const n = a.length;
  if (n !== b.length) return false;
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Custom map function with strong typing.
export function mapNonEmpty<A, B>(xs: NonEmptyReadonlyArray<A>, f: (a: A, i: number) => B): NonEmptyReadonlyArray<B> {
  const head = f(xs[0], 0);
  const out: [B, ...B[]] = [head];
  for (let i = 1; i < xs.length; i++) {
    out.push(f(xs[i], i));
  }
  return out; // OK: [B, ...B[]] is assignable to readonly [B, ...B[]]
}

export function hasNonZeroValue(arr: ReadonlyArray<number>): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== 0) {
      return true;
    }
  }
  return false;
}