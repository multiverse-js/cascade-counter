import type { Action, Reducer, ActionHandlers, ActionMap } from "./types";

export class Engine<Target, State, A extends Action> {
  protected target: Target;
  protected state: State;
  protected readonly reducer: Reducer<Target, A>;

  constructor(target: Target, state: State, reducer: Reducer<Target, A>) {
    this.target = target;
    this.state = state;
    this.reducer = reducer;
  }

  dispatch(action: A): State {
    this.target = this.reducer(this.target, action);
    return this.state;
  }
}

export function createActionReducer<S, A extends Action>(
  handlers: ActionHandlers<S, A>
): Reducer<S, A> {
  return function reducer(state: S, action: A): S {
    // Tell TS that action.type is one of the handler keys
    const key = action.type as keyof typeof handlers;
    const handler = handlers[key] as ((state: S, action: A) => S);

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