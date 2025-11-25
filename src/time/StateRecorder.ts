import { Timeline } from "./Timeline";

export interface StateRecorderOptions<State, Snapshot, Patch> {
  timeline: Timeline<Snapshot, Patch>;
  snapshot: (state: State) => Snapshot;
  patch: (from: Snapshot, to: Snapshot) => Patch;
}

/**
 * StateRecorder: ergonomic layer on top of Timeline
 * - commit(state): capture baseline snapshot before a batch of changes
 * - push(state): compute patch vs committed snapshot and push into Timeline
 */
export class StateRecorder<State, Snapshot, Patch> {
  private timeline: Timeline<Snapshot, Patch>;
  private snapshotFn: (state: State) => Snapshot;
  private patchFn: (from: Snapshot, to: Snapshot) => Patch;
  private committedSnapshot?: Snapshot;

  constructor(options: StateRecorderOptions<State, Snapshot, Patch>) {
    this.timeline = options.timeline;
    this.snapshotFn = options.snapshot;
    this.patchFn = options.patch;
  }

  /** Seed the timeline with the initial full snapshot. */
  pushInitial(state: State): number {
    const snap = this.snapshotFn(state);
    this.committedSnapshot = snap;
    return this.timeline.pushFull(snap);
  }

  commit(state: State): void {
    // capture baseline snapshot before a batch of changes
    this.committedSnapshot = this.snapshotFn(state);
  }

  push(state: State, label?: string): number {
    const snap = this.snapshotFn(state);
    let index;

    if (this.committedSnapshot) {
      const patch = this.patchFn(this.committedSnapshot, snap);
      index = this.timeline.pushPatch(patch, label);
    } else {
      index = this.timeline.pushFull(snap, label);
    }
    this.committedSnapshot = snap;

    return index;
  }
}