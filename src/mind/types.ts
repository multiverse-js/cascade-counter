// A generic Action type with a discriminated union shape
export interface Action<Type extends string = string> {
  type: Type;
  payload?: any;
}

// A reducer transforms a state given an action (pure function)
export type Reducer<S, A extends Action = Action> = (
  state: S,
  action: A
) => S;

// A mapping from action type strings to reducer functions
export type ActionHandlers<S, A extends Action> = {
  [T in A["type"]]?: (state: S, action: Extract<A, { type: T }>) => S;
};

// Something that *has* state
export interface HasState<S> {
  state: S;
}

// Either a bare state S, or an object that has `state: S`
export type StateLike<S> = S | HasState<S>;

// Derive the state type from a Target
export type StateOf<T> = T extends HasState<infer S> ? S : T;

export function isHasState<S>(value: StateLike<S>): value is HasState<S> {
  return typeof value === "object" && value !== null && "state" in value;
}