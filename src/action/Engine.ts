import { StateLike, Action, Reducer, StateOf, isHasState } from "./types";

export class Engine<S, Target extends StateLike<S>, A extends Action> {
  protected target: Target;
  protected readonly reducer: Reducer<Target, A>;

  constructor(target: Target, reducer: Reducer<Target, A>) {
    this.target = target;
    this.reducer = reducer;
  }

  get state(): StateOf<Target> {
    if (isHasState(this.target)) {
      // here TS knows: this.target is HasState<something>
      return this.target.state as StateOf<Target>;
    }
    // here it's the raw state type
    return this.target as StateOf<Target>;
  }

  dispatch(action: A): StateOf<Target> {
    this.target = this.reducer(this.target, action);
    return this.state;
  }
}