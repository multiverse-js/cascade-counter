import { TimelineEntry, TimelineMode } from "./types";

export interface TimelineConfig {
  mode: TimelineMode;
  checkpointInterval?: number;
}

export interface TimelineHooks<Snapshot, Patch = Snapshot> {
  applyPatchToSnapshot?: (base: Snapshot, patch: Patch) => Snapshot;
}

export class Timeline<Snapshot, Patch = Snapshot> {
  private entries: TimelineEntry<Snapshot, Patch>[] = [];
  private config: TimelineConfig;
  private hooks: TimelineHooks<Snapshot, Patch>;
  private latestSnapshot?: Snapshot;
  private cursor: number = -1; // -1 = no selection yet

  constructor(config: TimelineConfig, hooks: TimelineHooks<Snapshot, Patch>) {
    this.config = config;
    this.hooks = hooks;
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
      throw new Error(`Timeline.goTo(): index ${index} is out of bounds [0, ${length - 1}]`);
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
    if (!this.hooks.applyPatchToSnapshot) {
      throw new Error("Timeline.pushPatch() requires config.applyPatch.");
    }

    if (truncate) this.truncateFuture();

    const index = this.entries.length;
    const nextSnapshot = this.hooks.applyPatchToSnapshot(this.latestSnapshot, patch);

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
      throw new Error(`Timeline.getEntry(): Index out of range (got ${index})`);
    }
    return this.entries[index];
  }

  getSnapshotAt(index: number): Snapshot {
    if (index < 0 || index >= this.entries.length) {
      throw new Error(`Timeline.getSnapshotAt(): index ${index} is out of range [0, ${this.entries.length - 1}]`);
    }

    const entry = this.entries[index];

    // Fast path: snapshot already stored on this entry
    if (entry.snapshot) {
      return entry.snapshot;
    }

    // In 'full' mode, every entry *must* have a snapshot.
    if (this.config.mode === "full") {
      throw new Error(
        `Timeline.getSnapshotAt(): missing snapshot at index ${index} in 'full' mode`
      );
    }

    // In 'patch'/'hybrid' modes, we need applyPatch to reconstruct.
    const applyPatch = this.hooks.applyPatchToSnapshot;
    if (!applyPatch) {
      throw new Error(
        "Timeline.getSnapshotAt(): applyPatch is required in 'patch'/'hybrid' modes."
      );
    }

    // Find nearest previous snapshot
    let baseIndex = index;
    while (baseIndex >= 0 && !this.entries[baseIndex].snapshot) {
      baseIndex--;
    }

    if (baseIndex < 0) {
      // This means we have patches before any full snapshot, which violates invariants.
      throw new Error(
        `Timeline.getSnapshotAt(): no base snapshot found before index ${index}`
      );
    }

    let currentSnapshot = this.entries[baseIndex].snapshot as Snapshot;

    // Replay patches (and intermediate snapshots) up to 'index'
    for (let i = baseIndex + 1; i <= index; i++) {
      const e = this.entries[i];
      if (e.snapshot) {
        currentSnapshot = e.snapshot;
      } else if (e.patch !== undefined) {
        currentSnapshot = applyPatch(currentSnapshot, e.patch);
        e.snapshot = currentSnapshot; // cache reconstructed snapshot
      } else {
        // Patch entry without snapshot or patch would be nonsense.
        throw new Error(
          `Timeline.getSnapshotAt(): entry ${i} has neither snapshot nor patch`
        );
      }
    }

    return currentSnapshot;
  }

  getCurrentSnapshot(): Snapshot {
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