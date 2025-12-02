import { Ticker } from "../time/Ticker";

export interface AnimationHooks {
  onStart?: () => void;
  onFrame?: () => void;
  onStop?: () => void;
}

export interface AnimationConfig {
  ticker: Ticker;
}

/**
 * Generic base class for time-based animations.
 * Subclasses implement `update` and call `start()` / `stop()`.
 */
export abstract class Animation {
  protected readonly ticker: Ticker;
  protected readonly hooks: AnimationHooks;

  private running = false;
  private unsubscribe?: () => void;

  constructor(config: AnimationConfig, hooks: AnimationHooks = {}) {
    this.ticker = config.ticker;
    this.hooks = hooks;

    // Subscribe once for this animation instance
    this.unsubscribe = this.ticker.onTick((dtMs, tick, now) => {
      if (!this.running) return; // don't run update if "stopped"
      this.update(dtMs, tick, now);
      this.hooks.onFrame?.();
    });
  }

  /** Subclasses implement per-tick logic here. */
  protected abstract update(dtMs: number, tick: number, now: number): void;

  /** Start the animation. Safe to call repeatedly. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.hooks.onStart?.();
    this.ticker.start();
  }

  /** Stop the animation. Safe to call repeatedly. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.hooks.onStop?.();
    // Optional: you can ALSO stop the ticker if this animation
    // is the only user of that ticker. That's what you're doing now:
    this.ticker.stop();
  }

  /** Optional: call if you're completely done with this animation instance. */
  dispose(): void {
    this.stop();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}