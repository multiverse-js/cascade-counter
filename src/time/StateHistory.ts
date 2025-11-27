import { Timeline } from "./Timeline";
import { TimelineRecorder } from "./TimelineRecorder";
import { PatchDirection, TimelineMode } from "./types";

export interface StateHistoryConfig {
  mode?: TimelineMode;
  checkpointInterval?: number;
}

export interface StateHistoryHooks<State, Snapshot, Patch> {
  createSnapshot: (state: State) => Snapshot;
  createPatch: (prev: Snapshot, next: Snapshot) => Patch;
  applySnapshotToState: (snapshot: Snapshot, state: State) => void;
  applyPatchToSnapshot: (base: Snapshot, patch: Patch) => Snapshot;
  applyPatchToState?: (patch: Patch, direction: PatchDirection, state: State) => void
  isEmptyPatch?: (patch: Patch) => boolean;
}

export class StateHistory<State, Snapshot, Patch> {
  readonly state: State;
  readonly timeline: Timeline<Snapshot, Patch>;
  readonly recorder: TimelineRecorder<State, Snapshot, Patch>;

  private readonly hooks: StateHistoryHooks<State, Snapshot, Patch>;

  constructor(
    state: State,
    config: StateHistoryConfig = {},
    hooks: StateHistoryHooks<State, Snapshot, Patch>,
  ) {
    this.state = state;
    this.hooks = hooks;

    this.timeline = new Timeline<Snapshot, Patch>({
      mode: config.mode ?? "patch",
      checkpointInterval: config.checkpointInterval,
      applyPatch: (base, patch) => this.hooks.applyPatchToSnapshot(base, patch),
    });

    this.recorder = new TimelineRecorder<State, Snapshot, Patch>({
      timeline: this.timeline,
      snapshot: () => this.hooks.createSnapshot(this.state),
      patch: (from, to) => this.hooks.createPatch(from, to),
      isEmptyPatch: (patch) =>
        this.hooks.isEmptyPatch ? this.hooks.isEmptyPatch(patch) : false,
    });

    // initial snapshot
    this.recorder.record(this.state);
  }

  /** Resolve the snapshot to use for the current position (history or live). */
  resolveSnapshot(): Snapshot | undefined {
    if (this.timeline.isAtPresent()) {
      return this.hooks.createSnapshot(this.state);
    }
    const snapshot = this.timeline.getCurrentSnapshot();
    if (snapshot) return snapshot;

    return this.hooks.createSnapshot(this.state);
  }

  /** Take the snapshot at the current position (if any) and apply it to state. */
  applySnapshot(): Snapshot | undefined {
    const snapshot = this.timeline.getCurrentSnapshot();
    if (!snapshot) return undefined;

    this.hooks.applySnapshotToState(snapshot, this.state);

    return snapshot;
  }

  applySnapShotAt(index: number): Snapshot | undefined {
    const snapshot = this.timeline.getSnapshotAt(index);
    if (!snapshot) return undefined;

    this.hooks.applySnapshotToState(snapshot, this.state);

    return snapshot;
  }

  /**
   * Step one entry forward in time and mutate `state` using patches/snapshots.
   * Returns the snapshot for the new position, if any.
   */
  stepBy(offset: number): Snapshot | undefined {
    const oldIndex = this.timeline.index;

    if (!this.timeline.stepBy(offset)) return undefined;

    const newIndex = this.timeline.index;
    const entry = this.timeline.getEntry(oldIndex);

    if (this.hooks.applyPatchToState && entry.patch !== undefined) {
      // Apply forward patch to state
      this.hooks.applyPatchToState(
        entry.patch,
        offset > 0 ? "forward" : "backward",
        this.state
      );
      return this.hooks.createSnapshot(this.state);
    }

    // Fallback: if this entry stores a snapshot, just apply it
    return this.applySnapShotAt(newIndex);
  }
}