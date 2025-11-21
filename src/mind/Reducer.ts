import type {
  Action,
  ActionHandlers,
  ActionMap,
  Reducer
} from "./types";

// Produces a reducer from { type: handler } mapping
export function createActionReducer<S, A extends Action>(
  handlers: ActionHandlers<S, A>
): Reducer<S, A> {
  return function reducer(state: S, action: A): S {
    // Tell TS: action.type is one of the handler keys
    const key = action.type as keyof typeof handlers;
    const handler = handlers[key] as
      | ((state: S, action: A) => S)
      | undefined;

    return handler ? handler(state, action) : state;
  };
}

// Create a simple key → action mapping
export function createKeyMap<A extends Action>(
  keyBindings: Record<string, A>
): ActionMap<string, A> {
  return {
    match(key: string) {
      return keyBindings[key] ?? null;
    }
  };
}