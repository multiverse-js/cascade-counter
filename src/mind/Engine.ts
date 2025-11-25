import type {
  Action,
  Reducer,
  ActionHandlers,
  ActionMap,
  ActionReducerOptions
} from "./types";

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
  handlers: ActionHandlers<S, A>,
  options?: ActionReducerOptions<S, A>
): Reducer<S, A> {
  return (state: S, action: A): S => {
    const handler = handlers[action.type];
    if (!handler) return state;

    // Optional pre-guard: bail out before doing anything
    if (options?.guard && !options.guard(state, action)) {
      return state;
    }

    const result = handler(state, action);
    // If handler returns undefined, assume it mutated state in-place.
    return result === undefined ? state : result;
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