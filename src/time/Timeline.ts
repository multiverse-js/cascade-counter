import { TimelineEntry, TimelineMode } from "./types";

export interface TimelineConfig<Snapshot, Patch = Snapshot> {
  mode: TimelineMode;
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

  getLatestSnapshot(): Snapshot | undefined {
    return this.latestSnapshot;
  }

  /** Are we currently at the most recent entry? */
  isAtPresent(): boolean {
    return this.cursor === this.entries.length - 1;
  }

  goToStart(): boolean {
    if (this.entries.length === 0) return false;
    this.cursor = 0;
    return true;
  }

  /** Move cursor to the latest entry, if any. */
  goToEnd(): boolean {
    if (this.entries.length === 0) return false;
    this.cursor = this.entries.length - 1;
    return true;
  }

  /** Jump cursor directly to a specific index. Returns true if it moved. */
  goTo(index: number): boolean {
    const length = this.entries.length;
    if (index < 0 || index >= length) {
      throw new Error(`Timeline.skipTo(): index ${index} is out of bounds [0, ${length - 1}]`);
    }
    if (this.cursor === index) return false;
    this.cursor = index;
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

  /** Move cursor by a relative offset (can be negative).
   * Clamps to [0, entries.length - 1].
   * Returns true if the cursor actually changed.
   */
  stepBy(offset: number): boolean {
    if (offset === 0 || this.entries.length === 0) return false;

    const maxIndex = this.entries.length - 1;
    let target = this.cursor + offset;

    if (target < 0) target = 0;
    if (target > maxIndex) target = maxIndex;
    if (target === this.cursor) return false; // nothing changed

    this.cursor = target;
    return true;
  }

  /** Push a full snapshot and move cursor to it. */
  pushFull(snapshot: Snapshot, label?: string, truncateFuture: boolean = true): number {
    if (truncateFuture) this.truncateFuture();

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

    if (label) {
      entry.label = label;
    }
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
      throw new Error(`Timeline.getSnapshotAt(): Index out of range (got ${index})`);
    }
    return this.entries[index];
  }

  getSnapshotAt(index: number): Snapshot | undefined {
    if (index < 0 || index >= this.entries.length) {
      throw new Error(`Timeline.getSnapshotAt(): Index out of range (got ${index})`);
    }
    const entry = this.entries[index];
    if (entry.snapshot) {
      return entry.snapshot;
    }
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
    if (baseIndex < 0) {
      return undefined;
    }
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

  getCurrentSnapshot(): Snapshot | undefined {
    if (this.cursor < 0) {
      throw new Error("Timeline.getCurrentSnapshot(): no current entry (cursor < 0)");
    }
    return this.getSnapshotAt(this.cursor);
  }

  /** Keep entries up to current index; drop everything after. */
  private truncateFuture(): void {
    if (this.cursor < this.entries.length - 1) {
      this.entries.length = this.cursor + 1;

      if (this.entries.length === 0) {
        this.latestSnapshot = undefined;
        return;
      }

      const lastIndex = this.entries.length - 1;
      this.latestSnapshot = this.getSnapshotAt(lastIndex)!;
    }
  }
}