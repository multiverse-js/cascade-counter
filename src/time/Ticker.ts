export type TickEvent = (dtMs: number, tick: number, now: number) => void;

export interface TickerConfig {
  intervalMs?: number;   // target interval between ticks
  autoStart?: boolean;
}

export class Ticker {
  private intervalMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastTime: number | null = null;
  private tickCount = 0;
  private callbacks = new Set<TickEvent>();

  constructor(config: TickerConfig = {}) {
    this.intervalMs = config.intervalMs ?? 1000 / 60; // default ~60fps
    if (config.autoStart) {
      this.start();
    }
  }

  /** Register a tick handler. Returns an unsubscribe function. */
  onTick(callback: TickEvent): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /** Start continuous ticking. */
  start(): void {
    if (this.timer !== null) return; // already running

    this.lastTime = Date.now();
    this.scheduleNext();
  }

  /** Stop continuous ticking. */
  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.lastTime = null;
  }

  /** Manually fire a single tick (useful for step-by-step debugging). */
  stepOnce(): void {
    const now = Date.now();
    const last = this.lastTime ?? now;
    const dt = now - last;
    this.lastTime = now;
    this.fireTick(dt, now);
  }

  /** Change speed at runtime (e.g. slow-mo / fast-forward). */
  setIntervalMs(intervalMs: number): void {
    this.intervalMs = intervalMs;
    if (this.timer !== null) {
      // Restart with new interval
      this.stop();
      this.start();
    }
  }

  private scheduleNext(): void {
    this.timer = setTimeout(() => {
      const now = Date.now();
      const last = this.lastTime ?? now;
      const dt = now - last;
      this.lastTime = now;

      this.fireTick(dt, now);
      this.scheduleNext();
    }, this.intervalMs);
  }

  private fireTick(dtMs: number, now: number): void {
    this.tickCount++;
    for (const callback of this.callbacks) {
      callback(dtMs, this.tickCount, now);
    }
  }
}