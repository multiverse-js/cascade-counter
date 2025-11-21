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

export type ActionMap<E, A extends Action> = {
  match: (event: E) => A | null; 
};