import {
  clampToRange,
  posMod,
  arraysEqual
} from "../utils/MiscUtils";

import { WRAP_POLICY } from "./types";

import type {
  CascadeCounterOptions,
  BaseResolver,
  IterateDirection,
  MinOptions,
  NonEmptyReadonlyArray,
  WrapPolicy
} from "./types";

import {
  assertSafeInteger,
  assertSafePositiveInteger,
  assertSafeNonNegativeInteger,
  assertEquals,
  assertLessThan,
  type SafePositiveInteger
} from "../utils/AssertUtils";

/**
 * A generalized **mixed-radix counter** supporting dynamic per-level bases,
 * cascading carry/borrow arithmetic, and multiple overflow modes.
 *
 * Each level `i` has its own base `bᵢ = getBase(i, values)`, which may vary 
 * dynamically depending on the current state.
 *
 * This counter supports:
 * - Arbitrary number of levels (`levels`)
 * - Dynamic or fixed per-level bases (`getBase`)
 * - Overflow/underflow/unbounded modes (`wrapPolicy`)
 * - Optional unbounded top-level digits (`allowNegativeTop`)
 *
 * Common use cases include:
 * - Nested iteration or pagination systems  
 * - Mixed-base arithmetic (e.g., time wheels, variable clocks)  
 * - State machines, index generators, and combinatorial counters
 */
export class CascadeCounter {
  // Re-export constants on the class for ergonomic, namespaced access
  static WrapPolicy = WRAP_POLICY;
  static NONE = WRAP_POLICY.NONE;
  static RESET = WRAP_POLICY.RESET;
  static WRAP = WRAP_POLICY.WRAP;

  private readonly getBase: BaseResolver;
  private readonly levels: number;
  private readonly _wrapPolicy: WrapPolicy;
  private readonly _allowNegativeTop: boolean;

  private _values: number[];
  private _version = 0;

  /** Optional prevalidated base list for fixed-base optimization. */
  #fixedBases: ReadonlyArray<SafePositiveInteger> | null = null;
  /** Optional prevalidated multipliers list for fixed-base optimization. */
  #multipliers: ReadonlyArray<number> | null = null;

  /**
   * Constructs a new mixed-radix counter.
   *
   * @param getBase A function returning the base for a given level.
   *                Receives `(level, values)` where `values` is the current working digit vector.
   * @param options Configuration for level count, initial state, and overflow behavior.
   * @throws If neither `levels` nor `initial` are provided, or if bases/lengths are invalid.
   */
  constructor(getBase: BaseResolver, options: CascadeCounterOptions = {}) {
    const {
      levels,
      initial,
      wrapPolicy,
      allowNegativeTop
    } = CascadeCounter._resolveConfig(options);

    this.getBase = getBase;
    this.levels = levels;
    this._wrapPolicy = wrapPolicy;
    this._allowNegativeTop = allowNegativeTop;
    this._values = initial ? [...initial] : Array(this.levels).fill(0);
    this._clampAll();
  }

  /**
   * Internal: normalizes and validates configuration parameters.
   * Throws on inconsistent or unsupported combinations.
   */
  private static _resolveConfig(options: CascadeCounterOptions) {
    const {
      levels,
      initial,
      wrapPolicy = CascadeCounter.WRAP,
      allowNegativeTop = false,
    } = options;

    let resolvedLevels: number;

    if (levels != null) {
      assertSafePositiveInteger("_resolveConfig", "levels", levels);
      if (initial) assertEquals("_resolveConfig", "initial.length", initial.length, levels);
      resolvedLevels = levels;
    } else {
      if (!initial) throw new TypeError("_resolveConfig(): either 'levels' or 'initial' must be provided");
      resolvedLevels = initial.length;
    }
    if (wrapPolicy !== CascadeCounter.NONE && allowNegativeTop) {
      throw new TypeError(
        `_resolveConfig(): 'allowNegativeTop' is only applicable when 'wrapPolicy=${CascadeCounter.NONE}' (unbounded top level)`
      );
    }
    return {
      levels: resolvedLevels,
      initial,
      wrapPolicy,
      allowNegativeTop
    };
  }

  /**
   * Adds `delta` to the digit at `startIndex` level, cascading carry or borrow
   * through higher levels as needed.
   *
   * **Behavior:**
   * - Inner levels (`i < last`) are normalized into `[0, base - 1]`.
   * - Top-level behavior depends on `wrapPolicy`:
   *   - If `wrapPolicy === none`: top level is unbounded, may grow indefinitely or go negative (if allowed).
   *   - If `wrapPolicy === reset`: overflow/underflow resets **all digits** to `0`.
   *   - If `wrapPolicy === wrap`: top level wraps around modulo its base.
   *
   * @param startIndex The starting level for the addition (default `0`).
   * @param delta      The amount to add (positive or negative, default `1`).
   * @returns `this` (mutates in place).
   */
  incrementAt(startIndex = 0, delta = 1): this {
    return this._offsetAt(startIndex, delta, "incrementAt");
  }

  decrementAt(startIndex = 0, delta = 1): this {
    return this._offsetAt(startIndex, -delta, "decrementAt");
  }

  next(delta = 1): this {
    if (delta < 0) {
      return this.prev(-delta);
    }
    return this._offsetAt(0, delta, "next");
  }

  prev(delta = 1): this {
    if (delta < 0) {
      return this.next(-delta);
    }
    return this._offsetAt(0, -delta, "prev");
  }

  /** Resets all digits to zero. */
  reset(): this {
    this._values = Array(this.levels).fill(0);
    this._version++;

    return this;
  }

  /**
   * Returns true iff calling next(1) would not wrap or reset.
   * 
   * getBase must be referentially transparent for a given values during a call.
   */
  canNext(): boolean {
    return this.wrapPolicy === CascadeCounter.NONE || !this.isMax();
  }

  /** Returns true iff calling prev(1) would not wrap or reset. */
  canPrev(options: MinOptions = {}): boolean {
    if (this.wrapPolicy !== CascadeCounter.NONE) return !this.isMin(options);
    if (this._allowNegativeTop) return true;

    const values = this._valuesView;

    for (let i = 0; i < this.levels; i++) {
      if (values[i] !== 0) {
        return true;
      }
    }
    return false;
  }

  /** getBase must be referentially transparent for a given values during a call. */
  peekNextValues(): ReadonlyArray<number> | null {
    if (this.canNext()) {
      return this._clone().next().values;
    }
    return null;
  }

  peekPrevValues(options: MinOptions = {}): ReadonlyArray<number> | null {
    if (this.canPrev(options)) {
      return this._clone().prev().values;
    }
    return null;
  }

  tryNext(): boolean {
    if (this.canNext()) {
      this.next();
      return true;
    }
    return false;
  }

  tryPrev(options: MinOptions = {}): boolean {
    if (this.canPrev(options)) {
      this.prev();
      return true;
    }
    return false;
  }

  /**
   * Sets a single digit value at the specified level.
   * 
   * - Inner levels are clamped into `[0, base - 1]`.  
   * - Top level is only clamped when a `wrapPolicy` is used.
   */
  setAt(index: number, value: number): this {
    this._assertValidLevel(index, "setAt");
    assertSafeInteger("setAt", "value", value);

    const base = this._getBaseAt(index, "setAt");
    const next = this.isBoundedLevel(index) ? clampToRange(value, 0, base - 1) : value;

    if (this._values[index] === next) {
      return this;
    }
    if (this._isUnboundedTopDigit(index)) {
      this._assertTopDigitNonNegative(next, "setAt");
    }
    this._mutate((_, write) => write(index, next));

    return this;
  }

  /**
   * Replaces all digit values with `values`.
   * 
   * - Validates length equality.
   * - Clamps inner levels to `[0, base - 1]`.
   * - Top level is clamped only when a `wrapPolicy` is used.
   *
   * @throws If array length does not match the number of levels.
   */
  set(nextValues: ReadonlyArray<number>): this {
    this._assertValuesValid(nextValues, "set");
    if (arraysEqual(this._valuesView, nextValues)) return this;

    this._values = [...nextValues];
    this._version++;

    return this;
  }

  /** Returns the digit value at the specified level. */
  getAt(index: number): number {
    this._assertValidLevel(index, "getAt");
    return this._valuesView[index];
  }

  /** Returns the base value at the specified level. */
  getBaseAt(index: number): number {
    this._assertValidLevel(index, "getBaseAt");
    return this._getBaseAt(index, "getBaseAt");
  }

  /** 
   * Returns true iff the digit vector is at its maximum under the *current* per-level bases.
   * 
   * getBase must be referentially transparent for a given values during a call.
   *
   * Notes:
   * - If wrapPolicy === CascadeCounter.NONE (unbounded top), there is no maximum ⇒ false.
   * - For dynamic bases, this is a *local* notion: small changes to `values`
   *   may change the bases and therefore what "max" means.
   */
  isMax(): boolean {
    // No max if the top level is unbounded
    if (this.wrapPolicy === CascadeCounter.NONE) return false;

    const fixedBases = this.#fixedBases;
    const values = this._valuesView;

    // Fixed bases path
    if (fixedBases) {
      for (let i = 0; i < this.levels; i++) {
        if (values[i] !== fixedBases[i] - 1) {
          return false;
        }
      }
      return true;
    }

    // Dynamic bases path
    for (let i = 0; i < this.levels; i++) {
      const base = this._getBaseAt(i, "isMax", values);
      if (values[i] !== base - 1) {
        return false;
      }
    }
    return true;
  }

  /** Current per-level maxima under present bases. Throws if unbounded top. */
  maxValuesNow(): ReadonlyArray<number> {
    if (this.wrapPolicy === CascadeCounter.NONE) {
      throw new Error(
        `maxValuesNow(): unavailable when top is unbounded (wrapPolicy='${CascadeCounter.NONE}')`
      );
    }
    const fixedBases = this.#fixedBases;
    const out = new Array(this.levels);

    if (fixedBases) {
      for (let i = 0; i < this.levels; i++) {
        out[i] = fixedBases[i] - 1;
      }
      return out;
    }
    const values = this._valuesView;

    for (let i = 0; i < this.levels; i++) {
      out[i] = this._getBaseAt(i, "maxValuesNow", values) - 1;
    }
    return out;
  }

  /**
   * True iff all digits are at their local minimum under current bases.
   * 
   * When zeroIsMin=true and wrapPolicy=CascadeCounter.NONE, [0,...,0] counts as "min" even though the space is unbounded.
   */
  isMin(options: MinOptions = {}): boolean {
    if (!options.zeroIsMin && this.wrapPolicy === CascadeCounter.NONE) return false;

    const values = this._valuesView;

    for (let i = 0; i < this.levels; i++) {
      if (values[i] !== 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns a cloned counter with a new digit vector, 
   * if valid under current configuration.
   *
   * @throws If the provided values are invalid for this counter.
   */
  clone(values?: ReadonlyArray<number>): CascadeCounter {
    if (values !== undefined) {
      this._assertValuesValid(values, "clone");
      return this._clone(values);
    }
    return this._clone();
  }

  /**
   * Compares this counter’s state and configuration to another.
   * 
   * Equality ignores `getBase` function identity, 
   * but checks digits and relevant flags.
   */
  equals(other: CascadeCounter): boolean {
    if (this === other) return true;
    if (
      this.levels !== other.size ||
      this.wrapPolicy !== other.wrapPolicy ||
      this._allowNegativeTop !== other._allowNegativeTop
    ) return false;

    return arraysEqual(this._valuesView, other.values);
  }

  /**
   * Checks whether a candidate digit vector is valid for this configuration.
   * 
   * Uses the candidate itself for dynamic base calculations.
   */
  areValuesValid(values: ReadonlyArray<number>): boolean {
    if (values.length !== this.levels) return false;

    for (let i = 0; i < this.levels; i++) {
      if (!this.isValueValid(values[i], i, values)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validates a single digit’s safety for the given level and context.
   * 
   * - Inner levels must be integers in `[0, base - 1]`.
   * - The top level:
   *   - is unbounded if `wrapPolicy=CascadeCounter.NONE`.
   *   - may go negative if `allowNegativeTop=true`.
   *   - is clamped/wrapped if `wrapPolicy=CascadeCounter.RESET` or `wrapPolicy=CascadeCounter.WRAP`.
   */
  isValueValid(
    value: number,
    index: number,
    values: ReadonlyArray<number> = this._valuesView
  ): boolean {
    this._assertValidLevel(index, "isValueValid");
    if (!Number.isSafeInteger(value)) return false;

    if (this.isBoundedLevel(index)) {
      const base = this._getBaseAt(index, "isValueValid", values);
      return value >= 0 && value < base;
    }
    return this._allowNegativeTop || value >= 0;
  }

  /**
   * Converts the current digit vector (or a provided one) into a single
   * linear index using mixed-radix arithmetic.
   *
   * The mapping is defined only when fixed bases are present.
   * 
   * Example:
   *   bases = [10, 5, 3]
   *   values = [7, 2, 1]  →  index = 7 + 2*10 + 1*(10*5) = 77
   *
   * @param values Optional digit vector; defaults to `this.values`.
   * @returns The corresponding linear index.
   * @throws If the counter has dynamic (non-fixed) bases.
   */
  toIndex(values = this.values): number {
    assertEquals("toIndex", "values.length", values.length, this.levels);

    if (this.wrapPolicy === CascadeCounter.NONE) {
      throw new TypeError(
        `toIndex(): cannot encode when top level is unbounded (wrapPolicy='${CascadeCounter.NONE}')`
      );
    }
    if (!this.totalStatesFitsInSafeInteger()) {
      throw new RangeError(
        "toIndex(): product of bases exceeds Number.MAX_SAFE_INTEGER; use BigInt variant"
      );
    }

    const mult = this._multipliers();
    let index = 0;

    for (let i = 0; i < values.length; i++) {
      this._assertValidValue(values[i], i, values, "toIndex");
      index += values[i] * mult[i];
    }
    return index;
  }

  /**
     * Decodes a linear index back into its corresponding digit vector.
     * The inverse of {@link toIndex}.  Defined only for fixed bases.
     * 
     * Example:
     *   bases = [10, 5, 3]
     *   index = 77  →  values = [7, 2, 1]
     *
     * @param index Linear index to decode.
     * @returns A new digit vector representing that state.
     * @throws If the counter has dynamic (non-fixed) bases.
     */
  fromIndex(index: number): ReadonlyArray<number> {
    assertSafeNonNegativeInteger("fromIndex", "index", index);

    const fixedBases = this._assertAndGetFixedBases("fromIndex");
    const max = CascadeCounter.totalStates(fixedBases);

    assertSafeInteger("fromIndex", "max", max);
    assertLessThan("fromIndex", "index", index, max);

    const mult = this._multipliers();
    const values = new Array(this.levels).fill(0);
    let r = index;

    for (let i = this.levels - 1; i >= 0; i--) {
      const div = mult[i];
      values[i] = Math.floor(r / div) % fixedBases[i];
      r -= values[i] * div;
    }
    return values;
  }

  /** Iterate N steps forward or backward (respects wrapPolicy). */
  *iterate(
    steps: number,
    direction: IterateDirection = "forward",
    stopOnReset = false
  ): Iterable<ReadonlyArray<number>> {
    assertSafeNonNegativeInteger("iterate", "steps", steps);

    const shouldStopOnReset = stopOnReset && this.wrapPolicy === CascadeCounter.RESET;

    if (direction === "forward") {
      for (let i = 0; i < steps; i++) {
        this.next(1);
        yield this.values;
        if (shouldStopOnReset && this.isEmpty()) {
          break;
        }
      }
    } else {
      for (let i = 0; i < steps; i++) {
        this.prev(1);
        yield this.values; // fresh copy
        if (shouldStopOnReset && this.isEmpty()) {
          break; // yields reset state once, then exits
        }
      }
    }
  }

  isEmpty(): boolean {
    return this._valuesView.every(v => v === 0);
  }

  isTopLevel(index: number): boolean {
    return index === this.levels - 1;
  }

  isBoundedLevel(index: number): boolean {
    return this.wrapPolicy !== CascadeCounter.NONE || index < this.levels - 1;
  }

  isValidLevel(index: number): boolean {
    return Number.isSafeInteger(index) && index >= 0 && index < this.levels;
  }

  hasFixedBases(): boolean {
    return this.#fixedBases != null;
  }

  resolveBases(): ReadonlyArray<number> {
    const fixedBases = this.#fixedBases;

    return fixedBases ? fixedBases : Array.from(
      { length: this.size },
      (_, i) => this.getBaseAt(i)
    );
  }

  totalStates(): number {
    const bases = this._assertAndGetFixedBases("totalStates");
    return CascadeCounter.totalStates(bases);
  }

  totalStatesBigInt(): bigint {
    const bases = this._assertAndGetFixedBases("totalStatesBigInt");
    return CascadeCounter.totalStatesBigInt(bases);
  }

  totalStatesFitsInSafeInteger(): boolean {
    const bases = this._assertAndGetFixedBases("totalStatesFitsInSafeInteger");
    return CascadeCounter.totalStatesFitsInSafeInteger(bases);
  }

  /** Returns a string representation of the current digits, joined by `sep`. */
  toString(separator = ","): string {
    return this._valuesView.join(separator);
  }

  static totalStates(bases: ReadonlyArray<number>): number {
    let acc = 1;

    for (const b of bases) {
      // guard early to stay under MAX_SAFE_INTEGER
      if (acc > Number.MAX_SAFE_INTEGER / b) {
        throw new RangeError(
          "totalStates(): product exceeds Number.MAX_SAFE_INTEGER; " +
          "use totalStatesBigInt() instead"
        );
      }
      acc *= b;
    }
    return acc;
  }

  static totalStatesBigInt(bases: ReadonlyArray<number>): bigint {
    let acc = 1n;
    for (const b of bases) {
      acc *= BigInt(b);
    }
    return acc;
  }

  static totalStatesFitsInSafeInteger(bases: ReadonlyArray<number>): boolean {
    try {
      CascadeCounter.totalStates(bases);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates a counter with fixed per-level bases.
   * 
   * Equivalent to:
   * ```ts
   * new CascadeCounter((i) => bases[i], { levels: bases.length, ...options });
   * ```
   */
  static fromFixedBases(
    bases: NonEmptyReadonlyArray<number>,
    options: Omit<CascadeCounterOptions, "levels"> = {}
  ): CascadeCounter {
    for (const b of bases) assertSafePositiveInteger("fromFixedBases", "base", b);

    // Brand once after validation
    const frozen = Object.freeze(
      [...bases] as unknown as ReadonlyArray<SafePositiveInteger>
    );
    const counter = new CascadeCounter(
      (lvl, _) => frozen[lvl],
      { levels: frozen.length, ...options }
    );
    counter._setFixedBases(frozen);
    return counter;
  }

  /** Number of digit levels in this counter. */
  get size(): number {
    return this.levels;
  }

  /** Public: safe copy for external consumers. */
  get values(): ReadonlyArray<number> {
    return [...this._values];
  }

  get version(): number {
    return this._version;
  }

  get wrapPolicy(): WrapPolicy {
    return this._wrapPolicy;
  }

  get allowNegativeTop(): boolean {
    return this._allowNegativeTop;
  }

  // ---------- Internal utilities ----------

  /** Internal: zero-alloc readonly view of state. */
  private get _valuesView(): ReadonlyArray<number> {
    return this._values;
  }

  private _offsetAt(startIndex: number, delta: number, fn = "_offsetAt"): this {
    if (delta === 0) return this;

    this._assertValidLevel(startIndex, fn);
    assertSafeInteger(fn, "delta", delta);

    // Fast path: ±1 with no carry/borrow (any index)
    if (delta === 1) {
      const next = this._valuesView[startIndex] + 1;

      if (this._isUnboundedTopDigit(startIndex)) {
        // Unbounded top: no base check, just write
        this._mutate((_, write) => write(startIndex, next));
        return this;
      }
      const base = this._getBaseAt(startIndex, fn);
      if (next < base) {
        this._mutate((_, write) => write(startIndex, next));
        return this;
      }
    } else if (delta === -1) {
      const next = this._valuesView[startIndex] - 1;

      if (this._isUnboundedTopDigit(startIndex)) {
        // Unbounded top: allow negative only if configured
        this._assertTopDigitNonNegative(next, fn);
        this._mutate((_, write) => write(startIndex, next));
        return this;
      }
      // Bounded digit (inner digit or top when a `wrapPolicy` is used):
      if (next >= 0) {
        this._mutate((_, write) => write(startIndex, next));
        return this;
      }
    }

    // Slow path: Perform carry operations if needed
    this._mutate((values, write) => {
      let i = startIndex;
      let pending = delta;

      while (pending !== 0 && i < this.levels) {
        const base = this._getBaseAt(i, fn, values);
        const next = values[i] + pending;

        if (i < this.levels - 1) {
          // computes a positive modulo in the range [0, base - 1], even for negative inputs.
          const rem = posMod(next, base);
          const carry = (next - rem) / base;
          write(i, rem);
          pending = carry;
          i++;
        } else {
          if (this.wrapPolicy === CascadeCounter.RESET) {
            if (next >= base || next < 0) {
              for (let k = 0; k < this.levels; k++) {
                write(k, 0);
              }
              return;
            }
            write(i, next); // in-range [0, base-1], so safe to assign
          } else if (this.wrapPolicy === CascadeCounter.WRAP) {
            const rem = posMod(next, base);
            write(i, rem);
          } else {
            if (this._isUnboundedTopDigit(i)) {
              this._assertTopDigitNonNegative(next, fn);
            }
            write(i, next); // unbounded top level
          }
          pending = 0;
        }
      }
    });

    return this;
  }

  private _isUnboundedTopDigit(index: number): boolean {
    return this.wrapPolicy === CascadeCounter.NONE && index === this.levels - 1;
  }

  private _mutate(
    mutator: (
      values: ReadonlyArray<number>,
      write: (i: number, v: number) => void
    ) => void
  ): boolean {
    const src = this._valuesView;           // snapshot
    let work: ReadonlyArray<number> = src;  // data being worked on, read-only at first
    let buf: number[] | null = null;        // mutated buffer for holding temporary changes
    let changed = false;                    // tracks whether any change occurred

    const write = (i: number, v: number) => {
      const currentValue = (buf ?? src)[i];
      if (currentValue === v) return;  // no-op if no change
      if (!buf) {
        buf = [...src];    // initialize buffer on first change
        work = buf;
      }
      buf[i] = v;
      changed = true;
    }

    mutator(work, write);  // always pass an array, never null

    if (changed && buf) {
      this._values = buf;
      this._version++;
    }
    return changed;
  }

  /** Clamps digits within their valid ranges according to configuration. */
  private _clampAll(): void {
    const values = this._valuesView;
    const unboundedTop = this.wrapPolicy === CascadeCounter.NONE;
    const last = unboundedTop ? this.levels - 1 : this.levels;

    for (let i = 0; i < last; i++) {
      const base = this._getBaseAt(i, "_clampAll");
      this._values[i] = clampToRange(values[i], 0, base - 1);
    }
    if (unboundedTop) {
      this._assertTopDigitNonNegative(values[this.levels - 1], "_clampAll");
    }
  }

  private _multipliers(): ReadonlyArray<number> {
    if (this.#multipliers) return this.#multipliers;

    const fixedBases = this._assertAndGetFixedBases("_multipliers");
    const multipliers = new Array(fixedBases.length).fill(1);

    for (let i = 1; i < multipliers.length; i++) {
      const prev = multipliers[i - 1];
      const b = fixedBases[i - 1];
      if (prev > Number.MAX_SAFE_INTEGER / b) {
        throw new RangeError(
          "_multipliers(): product exceeds Number.MAX_SAFE_INTEGER; use BigInt variant"
        );
      }
      multipliers[i] = prev * b;
    }
    this.#multipliers = Object.freeze(multipliers);
    return this.#multipliers;
  }

  private _getBaseAt(
    i: number,
    fn = "_getBaseAt",
    values: ReadonlyArray<number> = this._valuesView
  ): SafePositiveInteger {
    const fixedBases = this.#fixedBases;
    // Use frozen reference if bases are fixed in order to bypass validity checks
    if (fixedBases) {
      return fixedBases[i] as SafePositiveInteger;
    }
    const base = this.getBase(i, values);
    assertSafePositiveInteger(fn, "base", base);

    return base;
  }

  private _setFixedBases(bases: ReadonlyArray<SafePositiveInteger>) {
    this.#fixedBases = bases;
  }

  private _clone(values: ReadonlyArray<number> = this._valuesView): CascadeCounter {
    return new CascadeCounter(this.getBase, {
      levels: this.levels,
      initial: [values[0], ...values.slice(1)],
      wrapPolicy: this.wrapPolicy,
      allowNegativeTop: this._allowNegativeTop,
    });
  }

  private _assertAndGetFixedBases(fn = "_assertAndGetFixedBases"): ReadonlyArray<SafePositiveInteger> {
    const bases = this.#fixedBases;
    if (!bases) {
      throw new Error(`${fn}() requires fixed bases`);
    }
    return bases;
  }

  private _assertValuesValid(values: ReadonlyArray<number>, fn = "_assertValuesValid"): void {
    if (!this.areValuesValid(values)) {
      throw new Error(
        `${fn}(): bad digit vector, expected '${this.levels}' values matching base constraints`
      );
    }
  }

  /** Throws if writing a negative value to the unbounded top level is disallowed. */
  private _assertTopDigitNonNegative(topValue: number, fn = "_assertTopDigitNonNegative"): void {
    if (topValue < 0 && !this._allowNegativeTop) {
      throw new RangeError(`${fn}(): top digit cannot be negative unless allowNegativeTop=true`);
    }
  }

  private _assertValidLevel(i: number, fn = "_assertValidLevel"): void {
    if (!this.isValidLevel(i)) {
      throw new RangeError(`${fn}(): index ${i} out of bounds`);
    }
  }

  private _assertValidValue(
    value: number,
    i: number,
    values: ReadonlyArray<number>,
    fn = "_assertValidValue"
  ): void {
    if (!this.isValueValid(value, i, values)) {
      throw new RangeError(`${fn}(): invalid value at index ${i} (got ${value})`);
    }
  }
}