import { Timeline } from "./Timeline";

export interface StateRecorderOptions<State, Snapshot, Patch> {
  timeline: Timeline<Snapshot, Patch>;
  snapshot: (state: State) => Snapshot;
  patch: (from: Snapshot, to: Snapshot) => Patch;
  isEmptyPatch?: (patch: Patch) => boolean;
}

/**
 * StateRecorder: ergonomic layer on top of Timeline
 * - commit(state): capture baseline snapshot before a batch of changes
 * - push(state): compute patch vs committed snapshot and push into Timeline
 */
export class StateRecorder<State, Snapshot, Patch> {
  readonly timeline: Timeline<Snapshot, Patch>;

  private readonly snapshot: (state: State) => Snapshot;
  private readonly patch: (from: Snapshot, to: Snapshot) => Patch;
  private readonly isEmptyPatch?: (patch: Patch) => boolean;

  constructor(options: StateRecorderOptions<State, Snapshot, Patch>) {
    this.timeline = options.timeline;
    this.snapshot = options.snapshot;
    this.patch = options.patch;
    this.isEmptyPatch = options.isEmptyPatch;
  }

  record(state: State, message?: string): number {
    const snap = this.snapshot(state);

    // First ever record: store full snapshot
    if (this.timeline.length === 0) {
      return this.timeline.pushFull(snap, message);
    }

    // Baseline: the snapshot at the current cursor position
    const prevSnapshot = this.timeline.getSnapshotAt(this.timeline.index)!;
    const patch = this.patch(prevSnapshot, snap);

    if (this.isEmptyPatch && this.isEmptyPatch(patch)) {
      // No state change → no new history entry
      return this.timeline.index;
    }
    return this.timeline.pushPatch(patch, message);
  }
}