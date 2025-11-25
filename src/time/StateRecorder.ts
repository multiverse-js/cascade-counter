import { Timeline } from "./Timeline";
import { CellPatch2D, CellPatch3D } from "./types";

export interface StateRecorderOptions<State, Snapshot, Diff> {
  timeline: Timeline<Snapshot, Diff>;
  snapshot: (state: State) => Snapshot;
  diff: (from: Snapshot, to: Snapshot) => Diff;
}

/**
 * StateRecorder: ergonomic layer on top of Timeline
 * - commit(state): capture baseline snapshot before a batch of changes
 * - push(state): compute diff vs committed snapshot and push into Timeline
 */
export class StateRecorder<State, Snapshot, Diff> {
  private timeline: Timeline<Snapshot, Diff>;
  private snapshotFn: (state: State) => Snapshot;
  private diffFn: (from: Snapshot, to: Snapshot) => Diff;
  private committedSnapshot?: Snapshot;

  constructor(opts: StateRecorderOptions<State, Snapshot, Diff>) {
    this.timeline = opts.timeline;
    this.snapshotFn = opts.snapshot;
    this.diffFn = opts.diff;
  }

  commit(state: State): void {
    // capture baseline snapshot before a batch of changes
    this.committedSnapshot = this.snapshotFn(state);
  }

  push(state: State, label?: string): number {
    const snap = this.snapshotFn(state);
    let index;

    if (this.committedSnapshot) {
      const diff = this.diffFn(this.committedSnapshot, snap);
      index = this.timeline.pushDiff(diff, label);
    } else {
      index = this.timeline.pushFull(snap, label);
    }
    this.committedSnapshot = snap;

    return index;
  }
}

export function diff2DArray<T>(
  prev: ReadonlyArray<T>,
  next: ReadonlyArray<T>,
  width: number,
  height: number
): CellPatch2D<T>[] {
  if (prev.length !== next.length) {
    throw new Error(
      `diff2DArray: prev and next must have same length (got ${prev.length} vs ${next.length})`
    );
  }

  if (prev.length !== width * height) {
    throw new Error(
      `diff2DArray: width*height = ${width * height} does not match array length = ${prev.length}`
    );
  }

  const patches: CellPatch2D<T>[] = [];
  const length = prev.length;

  for (let i = 0; i < length; i++) {
    const prevValue = prev[i];
    const nextValue = next[i];

    if (prevValue !== nextValue) {
      const x = i % width;
      const y = Math.floor(i / width);

      patches.push({ x, y, value: nextValue });
    }
  }

  return patches;
}

export function diff3DArray<T>(
  prev: ReadonlyArray<T>,
  next: ReadonlyArray<T>,
  width: number,
  height: number,
  depth: number
): CellPatch3D<T>[] {
  if (prev.length !== next.length) {
    throw new Error(
      `diff3DArray: prev and next must have same length (got ${prev.length} vs ${next.length})`
    );
  }

  const expectedSize = width * height * depth;
  if (prev.length !== expectedSize) {
    throw new Error(
      `diff3DArray: width*height*depth = ${expectedSize} does not match array length = ${prev.length}`
    );
  }

  const patches: CellPatch3D<T>[] = [];
  const length = prev.length;

  for (let index = 0; index < length; index++) {
    const prevValue = prev[index];
    const nextValue = next[index];

    if (prevValue !== nextValue) {
      const planeSize = width * height;

      const z = Math.floor(index / planeSize);
      const rem1 = index - z * planeSize;
      const y = Math.floor(rem1 / width);
      const x = rem1 % width;

      patches.push({ x, y, z, value: nextValue });
    }
  }

  return patches;
}