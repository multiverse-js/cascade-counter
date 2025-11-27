export interface TimelineEntry<Snapshot, Patch = Snapshot> {
  index: number;
  snapshot?: Snapshot;  // full snapshot (for checkpoints / caching)
  patch?: Patch;          // patch from previous
  label?: string;
  timestamp: number;
}

export interface TimelineConfig<Snapshot, Patch = Snapshot> {
  mode: "full" | "patch" | "hybrid";
  checkpointInterval?: number;
  applyPatch?: (base: Snapshot, patch: Patch) => Snapshot;
}

export class Timeline<Snapshot, Patch = Snapshot> {
  private entries: TimelineEntry<Snapshot, Patch>[] = [];
  private config: TimelineConfig<Snapshot, Patch>;
  private latestSnapshot?: Snapshot;
  private cursor: number = -1; // -1 = no selection yet

  constructor(config: TimelineConfig<Snapshot, Patch>) {
    this.config = config;
  }

  get length(): number {
    return this.entries.length;
  }

  /** Current cursor index, or -1 if nothing selected. */
  get index(): number {
    return this.cursor;
  }

  /** Are we currently at the most recent entry? */
  isAtPresent(): boolean {
    return this.cursor === this.entries.length - 1;
  }

  /** Move cursor to the latest entry, if any. */
  moveToPresent(): boolean {
    if (this.entries.length === 0) return false;
    this.cursor = this.entries.length - 1;
    return true;
  }

  /** Move cursor one step back. Returns true if it moved. */
  stepBackward(): boolean {
    if (this.cursor <= 0) return false;
    this.cursor--;
    return true;
  }

  /** Move cursor one step forward. Returns true if it moved. */
  stepForward(): boolean {
    if (this.cursor < 0 && this.entries.length > 0) {
      this.cursor = 0;
      return true;
    }
    if (this.cursor >= this.entries.length - 1) return false;
    this.cursor++;
    return true;
  }

  /** Push a full snapshot and move cursor to it. */
  pushFull(snapshot: Snapshot, label?: string, truncate: boolean = true): number {
    if (truncate) this.truncateFuture();

    const index = this.entries.length;
    const entry: TimelineEntry<Snapshot, Patch> = {
      index,
      snapshot,
      timestamp: Date.now(),
    };
    if (label) entry.label = label;

    this.entries.push(entry);
    this.latestSnapshot = snapshot;
    this.cursor = index;
    return index;
  }

  /** Push a patch and move cursor to it. */
  pushPatch(patch: Patch, label?: string, truncate: boolean = true): number {
    if (this.config.mode === "full") {
      throw new Error("Timeline.pushPatch() called in 'full' mode.");
    }
    if (!this.latestSnapshot) {
      throw new Error(
        "Timeline.pushPatch() called with no base snapshot; call pushFull() at least once."
      );
    }
    if (!this.config.applyPatch) {
      throw new Error("Timeline.pushPatch() requires config.applyPatch.");
    }
    if (truncate) this.truncateFuture();

    const index = this.entries.length;
    const nextSnapshot = this.config.applyPatch(this.latestSnapshot, patch);

    const checkpointInterval =
      this.config.mode === "hybrid"
        ? this.config.checkpointInterval ?? 10
        : undefined;

    const shouldStoreSnapshot =
      this.config.mode === "patch"
        ? false
        : checkpointInterval !== undefined &&
        (index % checkpointInterval === 0);

    const entry: TimelineEntry<Snapshot, Patch> = {
      index,
      patch,
      timestamp: Date.now(),
    };
    if (label) entry.label = label;
    if (shouldStoreSnapshot) {
      entry.snapshot = nextSnapshot;
    }

    this.entries.push(entry);
    this.latestSnapshot = nextSnapshot;
    this.cursor = index;
    return index;
  }

  getEntry(index: number): TimelineEntry<Snapshot, Patch> {
    if (index < 0 || index >= this.entries.length) {
      throw new Error("bad index");
    }
    return this.entries[index];
  }

  getSnapshotAt(index: number): Snapshot | undefined {
    if (index < 0 || index >= this.entries.length) {
      throw new Error("bad index");
    }
    const entry = this.entries[index];
    if (entry.snapshot) return entry.snapshot;

    if (this.config.mode === "full") {
      return undefined;
    }
    if (!this.config.applyPatch) {
      throw new Error(
        "Timeline.getSnapshotAt() requires applyPatch in 'patch'/'hybrid' modes."
      );
    }

    // find nearest previous snapshot
    let baseIndex = index;
    while (baseIndex >= 0 && !this.entries[baseIndex].snapshot) {
      baseIndex--;
    }
    if (baseIndex < 0) return undefined;

    let currentSnapshot = this.entries[baseIndex].snapshot as Snapshot;

    for (let i = baseIndex + 1; i <= index; i++) {
      const e = this.entries[i];
      if (e.snapshot) {
        currentSnapshot = e.snapshot;
      } else if (e.patch !== undefined) {
        currentSnapshot = this.config.applyPatch(currentSnapshot, e.patch);
        e.snapshot = currentSnapshot; // cache
      }
    }

    return currentSnapshot;
  }

  /** Convenience: snapshot at current cursor. */
  getCurrentSnapshot(): Snapshot | undefined {
    if (this.cursor < 0) throw new Error("bad index");
    return this.getSnapshotAt(this.cursor);
  }

  nextSnapshot(takeSnapshot: () => Snapshot): Snapshot | undefined {
    if (this.isAtPresent()) {
      return takeSnapshot();
    }
    const snapshot = this.getCurrentSnapshot();
    if (!snapshot) {
      return takeSnapshot();
    }
    return snapshot;
  }

  applyCurrentSnapshot(applySnapshotToState: (snap: Snapshot) => void): Snapshot | undefined {
    const snapshot = this.getCurrentSnapshot();
    if (snapshot) {
      applySnapshotToState(snapshot);
    }
    return snapshot;
  }

  // Keep entries up to current index; drop everything after
  private truncateFuture(): void {
    if (this.index < this.entries.length - 1) {
      this.entries.length = this.index + 1;
    }
  }
}
