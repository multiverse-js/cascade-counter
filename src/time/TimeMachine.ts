import { Timeline, TimelineConfig, TimelineHooks } from "./Timeline";
import { PatchDirection, TimeMachineTopology } from "./types";

export interface TimeMachineHooks<State, Snapshot, Patch = Snapshot>
  extends TimelineHooks<Snapshot, Patch> {
  createSnapshot: (state: State) => Snapshot;
  applySnapshotToState: (snap: Snapshot, state: State) => void;
  createPatch?: (prev: Snapshot, next: Snapshot) => Patch;
  applyPatchToState?: (patch: Patch, direction: PatchDirection, state: State) => void;
  isEmptyPatch?: (patch: Patch) => boolean;
}

export interface TimeMachineConfig extends TimelineConfig {
  topology?: TimeMachineTopology;
}

export interface TimeMachineBranch<Snapshot, Patch = Snapshot> {
  id: number;
  parentId?: number;
  forkIndex?: number; // Index in parent timeline where this branch was forked
  timeline: Timeline<Snapshot, Patch>;
  label?: string;
}

export class TimeMachine<State, Snapshot, Patch = Snapshot> {
  readonly state: State;

  private readonly hooks: TimeMachineHooks<State, Snapshot, Patch>;
  private readonly config: TimeMachineConfig;
  private readonly topology: TimeMachineTopology;
  private readonly branches = new Map<number, TimeMachineBranch<Snapshot, Patch>>();

  private nextBranchId = 1;
  private currentBranchId = 0;

  constructor(
    state: State,
    config: TimeMachineConfig,
    hooks: TimeMachineHooks<State, Snapshot, Patch>,
  ) {
    this.state = state;
    this.hooks = hooks;
    this.config = config;
    this.topology = config.topology ?? "linear";

    // In patch/hybrid modes, we *require* createPatch
    if ((config.mode === "patch" || config.mode === "hybrid") && !hooks.createPatch) {
      throw new Error(
        `TimeMachine: createPatch hook is required in '${config.mode}' mode.`
      );
    }

    // root branch + root timeline
    const rootTimeline = new Timeline<Snapshot, Patch>(
      { mode: config.mode, checkpointInterval: config.checkpointInterval },
      { applyPatchToSnapshot: hooks.applyPatchToSnapshot },
    );

    this.branches.set(0, {
      id: 0,
      timeline: rootTimeline,
      label: "root",
    });
    this.currentBranchId = 0;
  }

  // -------------------------------------------------------------------------
  // Branching API
  // -------------------------------------------------------------------------

  // public API still exposes a single `timeline`, but it’s the *current* branch’s timeline
  get timeline(): Timeline<Snapshot, Patch> {
    return this.branches.get(this.currentBranchId)!.timeline;
  }

  get branchCount(): number {
    return this.branches.size;
  }

  get branchId(): number {
    return this.currentBranchId;
  }

  /** Info-only view of branches (no Timeline references). */
  getBranches(): Array<{
    id: number;
    parentId?: number;
    forkIndex?: number;
    label?: string;
  }> {
    return Array.from(this.branches.values()).map(b => ({
      id: b.id,
      parentId: b.parentId,
      forkIndex: b.forkIndex,
      label: b.label,
    }));
  }

  private getOrderedBranchIds(): number[] {
    // Deterministic order, independent of Map insertion quirks
    return Array.from(this.branches.keys()).sort((a, b) => a - b);
  }

  /** Cycle to the "next" branch (by id), wrapping around. */
  nextBranch(): Snapshot {
    return this.cycleBranch(1);
  }

  /** Cycle to the "previous" branch (by id), wrapping around. */
  previousBranch(): Snapshot {
    return this.cycleBranch(-1);
  }

  /**
   * Cycle branches by an offset in the ordered list of branch ids.
   * Positive = forward, negative = backward. Wraps around.
   */
  cycleBranch(offset: number): Snapshot {
    if (this.topology !== "branching") {
      throw new Error("TimeMachine.cycleBranch(): branching topology is disabled");
    }

    const ids = this.getOrderedBranchIds();
    if (ids.length === 0) {
      throw new Error("TimeMachine.cycleBranch(): no branches available");
    }

    const currentIndex = ids.indexOf(this.currentBranchId);
    if (currentIndex === -1) {
      throw new Error(
        `TimeMachine.cycleBranch(): currentBranchId ${this.currentBranchId} not found`
      );
    }

    const len = ids.length;
    const nextIndex = ((currentIndex + offset) % len + len) % len;
    const nextId = ids[nextIndex];

    return this.switchBranch(nextId);
  }

  /** Switch to a different branch and apply its current snapshot to state. */
  switchBranch(branchId: number): Snapshot {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`TimeMachine.switchBranch(): unknown branch id ${branchId}`);
    }
    this.currentBranchId = branchId;
    // apply that branch’s current snapshot to state
    const snap = this.timeline.getCurrentSnapshot();
    this.hooks.applySnapshotToState(snap, this.state);
    return snap;
  }

  // -------------------------------------------------------------------------
  // Core recording / time travel
  // -------------------------------------------------------------------------

  commit(message?: string): Snapshot {
    const snap = this.hooks.createSnapshot(this.state);
    const { createPatch, isEmptyPatch } = this.hooks;

    let timeline = this.timeline; // current branch timeline

    // In branching mode, committing from the past forks a new branch
    if (this.topology === "branching" && !timeline.isAtPresent()) {
      const forkIndex = timeline.index;
      const newBranchId = this.nextBranchId++;
      const newTimeline = Timeline.forkFromExisting<Snapshot, Patch>(timeline, forkIndex);

      this.branches.set(newBranchId, {
        id: newBranchId,
        parentId: this.currentBranchId,
        forkIndex,
        timeline: newTimeline,
      });
      this.currentBranchId = newBranchId;
      timeline = newTimeline;
    }

    // First ever record in this branch: always store a full snapshot
    if (timeline.length === 0) {
      timeline.pushFull(snap, message);
      return snap;
    }

    // FULL MODE or no patch support: always store full snapshot
    if (!createPatch || this.config.mode === "full") {
      timeline.pushFull(snap, message);
      return snap;
    }

    // Baseline: snapshot at current cursor (present or history)
    const prevSnapshot =
      timeline.isAtPresent()
        ? timeline.getLatestSnapshot()!
        : timeline.getSnapshotAt(timeline.index)!;

    const patch = createPatch(prevSnapshot, snap);

    if (isEmptyPatch && isEmptyPatch(patch)) {
      // No state change → no new history entry
      return snap;
    }

    timeline.pushPatch(patch, message);
    return snap;
  }

  /** Resolve the snapshot to use for the current position (history or live). */
  resolveSnapshot(): Snapshot {
    const timeline = this.timeline;

    if (timeline.isAtPresent()) {
      return this.hooks.createSnapshot(this.state);
    }
    return timeline.getCurrentSnapshot();
  }

  goToEnd(): Snapshot {
    if (!this.timeline.goToEnd()) {
      throw new Error("TimeMachine.goToEnd(): empty timeline");
    }
    return this.applySnapshot();
  }

  goToStart(): Snapshot {
    if (!this.timeline.goToStart()) {
      throw new Error("TimeMachine.goToStart(): empty timeline");
    }
    return this.applySnapshot();
  }

  goTo(index: number): Snapshot {
    this.timeline.goTo(index);
    return this.applySnapshot();
  }

  stepBackward(steps: number): Snapshot {
    if (steps < 0) {
      throw new Error(`TimeMachine.rewind(): steps must not be negative (got ${steps})`);
    }
    return this.stepBy(steps, -1);
  }

  stepForward(steps: number): Snapshot {
    if (steps < 0) {
      throw new Error(`TimeMachine.fastForward(): steps must not be negative (got ${steps})`);
    }
    return this.stepBy(steps, 1);
  }

  stepRelative(steps: number): Snapshot {
    if (steps > 0) {
      return this.stepBy(steps, 1);
    }
    return this.stepBy(-steps, -1);
  }

  private stepBy(steps: number, stepDelta: 1 | -1): Snapshot {
    const timeline = this.timeline;

    if (steps === 0) {
      return this.resolveSnapshot();
    }
    if (steps < 0) {
      throw new Error(`TimeMachine.stepBy(): steps must not be negative (got ${steps})`);
    }

    const direction: PatchDirection = stepDelta > 0 ? "forward" : "backward";
    const { applyPatchToState, applySnapshotToState, createSnapshot } = this.hooks;

    for (let i = 0; i < steps; i++) {
      // move one step
      const moved = timeline.stepBy(stepDelta);
      if (!moved) break; // hit boundary

      if (applyPatchToState) {
        const entry = timeline.getEntry(timeline.index);
        if (entry.patch !== undefined) {
          applyPatchToState(entry.patch, direction, this.state);
          continue;
        }
      }

      // Fallback: apply snapshot at destination index
      const snap = timeline.getSnapshotAt(timeline.index);
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
