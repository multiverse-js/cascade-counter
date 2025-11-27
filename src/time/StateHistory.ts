import { Timeline } from "./Timeline";
import { TimelineRecorder } from "./TimelineRecorder";
import { TimelineMode } from "./types";

export interface StateHistoryConfig {
  mode?: TimelineMode;
  checkpointInterval?: number;
}

export interface StateHistoryHooks<State, Snapshot, Patch> {
  takeSnapshot: (state: State) => Snapshot;
  applySnapshotToState: (snapshot: Snapshot, state: State) => void;
  createPatch: (prev: Snapshot, next: Snapshot) => Patch;
  applyPatch: (base: Snapshot, patch: Patch) => Snapshot;
  isEmptyPatch?: (patch: Patch) => boolean;
}

export class StateHistory<State, Snapshot, Patch> {
  readonly state: State;
  readonly timeline: Timeline<Snapshot, Patch>;
  readonly recorder: TimelineRecorder<State, Snapshot, Patch>;

  private readonly hooks: StateHistoryHooks<State, Snapshot, Patch>;

  constructor(
    state: State,
    hooks: StateHistoryHooks<State, Snapshot, Patch>,
    config: StateHistoryConfig = {}
  ) {
    this.state = state;
    this.hooks = hooks;

    this.timeline = new Timeline<Snapshot, Patch>({
      mode: config.mode ?? "patch",
      checkpointInterval: config.checkpointInterval,
      applyPatch: (base, patch) => this.hooks.applyPatch(base, patch),
    });

    this.recorder = new TimelineRecorder<State, Snapshot, Patch>({
      timeline: this.timeline,
      snapshot: () => this.hooks.takeSnapshot(this.state),
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
      return this.hooks.takeSnapshot(this.state);
    }
    const snapshot = this.timeline.getCurrentSnapshot();
    if (!snapshot) {
      return this.hooks.takeSnapshot(this.state);
    }
    return snapshot;
  }

  /** Take the snapshot at the current position (if any) and apply it to state. */
  applySnapshot(): Snapshot | undefined {
    const snapshot = this.timeline.getCurrentSnapshot();
    if (snapshot) {
      this.hooks.applySnapshotToState(snapshot, this.state);
    }
    return snapshot;
  }
}