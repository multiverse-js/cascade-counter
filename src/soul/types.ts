export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

export type CascadeCounterOptions = {
  /**
   * Number of digit levels.  
   * If omitted, inferred from the length of `initial`.
   */
  readonly levels?: number;

  /**
   * Initial digit vector.  
   * If omitted, the counter starts at all zeros.
   */
  readonly initial?: NonEmptyReadonlyArray<number>;

  /**
   * Controls how the counter handles overflow or underflow at the top level.
   *
   * - `"none"` → Unbounded top; values grow freely (can go negative if `allowNegativeTop`).
   * - `"reset"` → Overflow or underflow resets all digits to `0`.
   * - `"wrap"` → Overflow or underflow wraps around modulo the top base.
   *
   * Default: `"none"`.
   */
  readonly wrapPolicy?: WrapPolicy;

  /**
   * Allows negative top-level digits when the counter is unbounded.
   *
   * - Applies **only** when `wrapPolicy = none` (top level unbounded).  
   * - If `true`, the top digit may be any integer (..., -2, -1, 0, 1, 2, ...).  
   * - If `false` (default), the top digit must be ≥ 0.  
   * - If used with `wrapPolicy !== "none"`, this option is invalid and will throw.
   */
  readonly allowNegativeTop?: boolean;
};

export const WRAP_POLICY = {
  NONE:  "none",
  RESET: "reset",
  WRAP:  "wrap",
} as const;

export type WrapPolicy = typeof WRAP_POLICY[keyof typeof WRAP_POLICY];

export type BaseResolver = (
  level: number,
  values: ReadonlyArray<number>
) => number;

export type PartialBaseResolver = (
  level: number,
  values: ReadonlyArray<number>
) => number | undefined;

export type NamedBaseResolver<T extends ReadonlyArray<string>> = {
  /** Ordered, immutable list of dimension names */
  readonly names: T;
  /** Get the 0-based index for a given name; should throw on unknown names */
  readonly indexOf: (name: T[number]) => number;
  readonly resolver: BaseResolver;
};

export type AnyResolverInput<T extends ReadonlyArray<string> = ReadonlyArray<string>> =
  | BaseResolver
  | PartialBaseResolver
  | NamedBaseResolver<T>;

export type ValidateOptions = {
  validate?: boolean
};

export type BaseRules = number | ((values: ReadonlyArray<number>) => number);

export type IterateDirection = "forward" | "backward";

export type MinOptions = {
  zeroIsMin?: boolean
};

export type StringRenderable = { toString(): string };