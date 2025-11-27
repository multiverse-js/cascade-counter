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
  private readonly timeline: Timeline<Snapshot, Patch>;
  private readonly snapshot: (state: State) => Snapshot;
  private readonly patch: (from: Snapshot, to: Snapshot) => Patch;
  private readonly isEmptyPatch?: (patch: Patch) => boolean;

  private lastSnapshot?: Snapshot;

  constructor(options: StateRecorderOptions<State, Snapshot, Patch>) {
    this.timeline = options.timeline;
    this.snapshot = options.snapshot;
    this.patch = options.patch;
    this.isEmptyPatch = options.isEmptyPatch;
  }

  record(state: State, message?: string): number {
    const snap = this.snapshot(state);

    if (this.lastSnapshot) {
      const patch = this.patch(this.lastSnapshot, snap);

      if (this.isEmptyPatch && this.isEmptyPatch(patch)) {
        return this.timeline.index; // no-op, keep lastSnapshot as-is
      }
      const index = this.timeline.pushPatch(patch, message);
      this.lastSnapshot = snap;
      return index;
    }

    const index = this.timeline.pushFull(snap, message); // initial record
    this.lastSnapshot = snap;
    return index;
  }
}