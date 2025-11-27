// A generic Action type with a discriminated union shape
export interface Action<T extends string = string> {
  type: T;
  payload?: unknown;
}

// A reducer transforms a state given an action (pure function)
export type ActionReducer<S, A extends Action = Action> = (
  state: S,
  action: A
) => S;

export type Handler<S, A extends Action> = (
  state: S,
  action: A
) => S | void;

export type ActionHandlers<S, A extends Action> = {
  [T in A["type"]]?: Handler<S, Extract<A, { type: T }>>;
} & {
  // fallback so handlers[action.type] is allowed
  [key: string]: Handler<S, A> | undefined;
};

export type ActionMap<E, A extends Action> = {
  match: (event: E) => A | null;
};

export type ActionReducerOptions<S, A> = {
  guard?: (state: S, action: A) => boolean;
}