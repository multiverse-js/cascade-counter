import { Timeline, TimelineConfig, TimelineHooks } from "./Timeline";
import { PatchDirection } from "./types";

export interface TimeMachineHooks<State, Snapshot, Patch = Snapshot> extends TimelineHooks<Snapshot, Patch> {
  createSnapshot: (state: State) => Snapshot;
  applySnapshotToState: (snap: Snapshot, state: State) => void;
  createPatch?: (prev: Snapshot, next: Snapshot) => Patch;
  applyPatchToState?: (patch: Patch, direction: PatchDirection, state: State) => void;
  isEmptyPatch?: (patch: Patch) => boolean;
}

export class TimeMachine<State, Snapshot, Patch = Snapshot> {
  readonly state: State;
  readonly timeline: Timeline<Snapshot, Patch>;

  private readonly hooks: TimeMachineHooks<State, Snapshot, Patch>;
  private readonly config: TimelineConfig;

  constructor(
    state: State,
    config: TimelineConfig,
    hooks: TimeMachineHooks<State, Snapshot, Patch>,
  ) {
    this.state = state;
    this.hooks = hooks;
    this.config = config;

    // In patch/hybrid modes, we *require* createPatch
    if ((config.mode === "patch" || config.mode === "hybrid") && !hooks.createPatch) {
      throw new Error(
        `TimeMachine: createPatch hook is required in '${config.mode}' mode.`
      );
    }

    this.timeline = new Timeline<Snapshot, Patch>(
      config,
      {
        applyPatchToSnapshot: hooks.applyPatchToSnapshot,
      }
    );
  }

  commit(message?: string): Snapshot {
    const snap = this.hooks.createSnapshot(this.state);
    const { createPatch, isEmptyPatch } = this.hooks;

    // First ever record: always store a full snapshot
    if (this.timeline.length === 0) {
      this.timeline.pushFull(snap, message);
      return snap;
    }

    // FULL MODE: never use patches, just store snapshots every time
    if (!createPatch || this.config.mode === "full") {
      this.timeline.pushFull(snap, message);
      return snap;
    }

    // Baseline: snapshot at current cursor (present or history)
    const prevSnapshot =
      this.timeline.isAtPresent()
        ? this.timeline.getLatestSnapshot()!
        : this.timeline.getSnapshotAt(this.timeline.index)!;

    const patch = createPatch(prevSnapshot, snap);

    if (isEmptyPatch && isEmptyPatch(patch)) {
      // No state change → no new history entry
      return snap;
    }

    this.timeline.pushPatch(patch, message);
    return snap;
  }

  /** Resolve the snapshot to use for the current position (history or live). */
  resolveSnapshot(): Snapshot {
    if (this.timeline.isAtPresent()) {
      return this.hooks.createSnapshot(this.state);
    }
    return this.timeline.getCurrentSnapshot();
  }

  goToEnd(): Snapshot {
    if (!this.timeline.goToEnd()) {
      throw new Error("TimeMachine.goToEnd(): empty timeline");
    }
    return this.applySnapshot()!;
  }

  goToStart(): Snapshot {
    if (!this.timeline.goToStart()) {
      throw new Error("TimeMachine.goToStart(): empty timeline");
    }
    return this.applySnapshot()!;
  }

  goTo(index: number): Snapshot {
    this.timeline.goTo(index);
    return this.applySnapshot()!;
  }

  rewind(steps: number): Snapshot {
    if (steps < 0) {
      throw new Error(`TimeMachine.rewind(): steps must not be negative (got ${steps})`);
    }
    return this.stepBy(steps, -1);
  }

  fastForward(steps: number): Snapshot {
    if (steps < 0) {
      throw new Error(`TimeMachine.rewind(): steps must not be negative (got ${steps})`);
    }
    return this.stepBy(steps, 1);
  }

  seek(steps: number): Snapshot {
    if (steps > 0) return this.stepBy(steps, 1);
    return this.stepBy(-steps, -1);
  }

  private stepBy(steps: number, stepDelta: 1 | -1): Snapshot {
    if (steps === 0) {
      return this.resolveSnapshot();
    }

    const direction: PatchDirection = stepDelta > 0 ? "forward" : "backward";
    const { applyPatchToState, applySnapshotToState, createSnapshot } = this.hooks;

    for (let i = 0; i < steps; i++) {
      // move one step
      const moved = this.timeline.stepBy(stepDelta);
      if (!moved) break; // hit boundary

      if (applyPatchToState) {
        // when stepping forward, patch at `toIndex` takes you from (toIndex-1) → toIndex
        // when stepping backward, you still use the same patch, but `direction`="backward"
        const entry = this.timeline.getEntry(this.timeline.index);
        if (entry.patch !== undefined) {
          applyPatchToState(entry.patch, direction, this.state);
          continue;
        }
      }

      // Fallback: apply snapshot at destination index
      const snap = this.timeline.getSnapshotAt(this.timeline.index);
      applySnapshotToState(snap, this.state);
    }

    // snapshot of current live state after stepping
    return createSnapshot(this.state);
  }

  /** Take the snapshot at the current position (if any) and apply it to state. */
  private applySnapshot(): Snapshot {
    const snap = this.timeline.getCurrentSnapshot();

    this.hooks.applySnapshotToState(snap, this.state);

    return snap;
  }
}