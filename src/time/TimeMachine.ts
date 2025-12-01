import { Timeline } from "./Timeline";
import { PatchDirection, TimelineMode } from "./types";

export interface TimeMachineConfig {
  mode?: TimelineMode;
  checkpointInterval?: number;
}

export interface TimeMachineHooks<State, Snapshot, Patch> {
  createSnapshot: (state: State) => Snapshot;
  createPatch: (prev: Snapshot, next: Snapshot) => Patch;
  applySnapshotToState: (snap: Snapshot, state: State) => void;
  applyPatchToSnapshot?: (base: Snapshot, patch: Patch) => Snapshot;
  applyPatchToState?: (patch: Patch, direction: PatchDirection, state: State) => void
  isEmptyPatch?: (patch: Patch) => boolean;
}

export class TimeMachine<State, Snapshot, Patch = Snapshot> {
  readonly state: State;
  readonly timeline: Timeline<Snapshot, Patch>;

  private readonly hooks: TimeMachineHooks<State, Snapshot, Patch>;

  constructor(
    state: State,
    config: TimeMachineConfig = {},
    hooks: TimeMachineHooks<State, Snapshot, Patch>,
  ) {
    this.state = state;
    this.hooks = hooks;
    const { applyPatchToSnapshot } = hooks;

    this.timeline = new Timeline<Snapshot, Patch>({
      mode: config.mode ?? "patch",
      checkpointInterval: config.checkpointInterval,
      ...(applyPatchToSnapshot && {
        applyPatch: (base, patch) => applyPatchToSnapshot(base, patch),
      }),
    });

    // initial snapshot
    this.commit();
  }

  commit(message?: string): Snapshot | undefined {
    const snap = this.hooks.createSnapshot(this.state);

    // First ever record: store full snapshot
    if (this.timeline.length === 0) {
      this.timeline.pushFull(snap, message);
      return snap;
    }

    // Baseline: the snapshot at the current cursor position
    const prevSnapshot =
      this.timeline.isAtPresent()
        ? this.timeline.getLatestSnapshot()!
        : this.timeline.getSnapshotAt(this.timeline.index)!;

    const patch = this.hooks.createPatch(prevSnapshot, snap);

    if (this.hooks.isEmptyPatch && this.hooks.isEmptyPatch(patch)) {
      // No state change → no new history entry
      return snap;
    }

    this.timeline.pushPatch(patch, message);
    return snap;
  }

  skipToEnd(): Snapshot {
    if (!this.timeline.skipToEnd()) {
      throw new Error("TimeMachine.skipToEnd(): empty timeline");
    }
    return this.applySnapshot()!;
  }

  skipToStart(): Snapshot {
    if (!this.timeline.skipToStart()) {
      throw new Error("TimeMachine.skipToStart(): empty timeline");
    }
    return this.applySnapshot()!;
  }

  skipTo(index: number): Snapshot | undefined {
    this.timeline.skipTo(index);

    return this.applySnapshot();
  }

  rewind(steps: number): Snapshot | undefined {
    if (steps === 0) return this.resolveSnapshot();
    if (steps < 0) throw new Error(`TimeMachine.rewind(): steps must not be negative (got ${steps})`);

    return this.stepBy(steps, -1);
  }

  fastForward(steps: number): Snapshot | undefined {
    if (steps === 0) return this.resolveSnapshot();
    if (steps < 0) throw new Error(`TimeMachine.fastForward(): steps must not be negative (got ${steps})`);

    return this.stepBy(steps, 1);
  }

  /** Resolve the snapshot to use for the current position (history or live). */
  resolveSnapshot(): Snapshot | undefined {
    if (this.timeline.isAtPresent()) {
      return this.hooks.createSnapshot(this.state);
    }
    return this.timeline.getCurrentSnapshot();
  }

  /** Take the snapshot at the current position (if any) and apply it to state. */
  private applySnapshot(): Snapshot | undefined {
    const snap = this.timeline.getCurrentSnapshot();
    if (!snap) return undefined;

    this.hooks.applySnapshotToState(snap, this.state);

    return snap;
  }

  private stepBy(steps: number, stepDelta: 1 | -1): Snapshot | undefined {
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
      if (!snap) return undefined;
      applySnapshotToState(snap, this.state);
    }

    // snapshot of current live state after stepping
    return createSnapshot(this.state);
  }
}