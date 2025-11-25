// time/Timeline.ts

export interface TimelineEntry<Snapshot, Diff = Snapshot> {
  index: number;
  snapshot?: Snapshot;  // full snapshot (for checkpoints / caching)
  diff?: Diff;          // diff from previous
  label?: string;
  timestamp: number;
}

export interface TimelineConfig<Snapshot, Diff = Snapshot> {
  mode: "full" | "diff" | "hybrid";
  checkpointInterval?: number;
  applyDiff?: (base: Snapshot, diff: Diff) => Snapshot;
}

export class Timeline<Snapshot, Diff = Snapshot> {
  private entries: TimelineEntry<Snapshot, Diff>[] = [];
  private config: TimelineConfig<Snapshot, Diff>;
  private latestSnapshot?: Snapshot;
  private cursor: number = -1; // -1 = no selection yet

  constructor(config: TimelineConfig<Snapshot, Diff>) {
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
  isAtLatest(): boolean {
    return this.cursor === this.entries.length - 1;
  }

  /** Move cursor to the latest entry, if any. */
  moveToLast(): boolean {
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
  pushFull(snapshot: Snapshot, label?: string): number {
    const index = this.entries.length;
    const entry: TimelineEntry<Snapshot, Diff> = {
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

  /** Push a diff and move cursor to it. */
  pushDiff(diff: Diff, label?: string): number {
    if (this.config.mode === "full") {
      throw new Error("Timeline.pushDiff() called in 'full' mode.");
    }
    if (!this.latestSnapshot) {
      throw new Error(
        "Timeline.pushDiff() called with no base snapshot; call pushFull() at least once."
      );
    }
    if (!this.config.applyDiff) {
      throw new Error("Timeline.pushDiff() requires config.applyDiff.");
    }

    const index = this.entries.length;
    const nextSnapshot = this.config.applyDiff(this.latestSnapshot, diff);

    const checkpointInterval =
      this.config.mode === "hybrid"
        ? this.config.checkpointInterval ?? 10
        : undefined;

    const shouldStoreSnapshot =
      this.config.mode === "diff"
        ? false
        : checkpointInterval !== undefined &&
          (index % checkpointInterval === 0);

    const entry: TimelineEntry<Snapshot, Diff> = {
      index,
      diff,
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

  getEntry(index: number): TimelineEntry<Snapshot, Diff> | undefined {
    if (index < 0 || index >= this.entries.length) return undefined;
    return this.entries[index];
  }

  getSnapshotAt(index: number): Snapshot | undefined {
    if (index < 0 || index >= this.entries.length) return undefined;

    const entry = this.entries[index];
    if (entry.snapshot) return entry.snapshot;

    if (this.config.mode === "full") {
      return undefined;
    }
    if (!this.config.applyDiff) {
      throw new Error(
        "Timeline.getSnapshotAt() requires applyDiff in 'diff'/'hybrid' modes."
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
      } else if (e.diff !== undefined) {
        currentSnapshot = this.config.applyDiff(currentSnapshot, e.diff);
        e.snapshot = currentSnapshot; // cache
      }
    }

    return currentSnapshot;
  }

  /** Convenience: snapshot at current cursor. */
  getCurrentSnapshot(): Snapshot | undefined {
    if (this.cursor < 0) return undefined;
    return this.getSnapshotAt(this.cursor);
  }
}
