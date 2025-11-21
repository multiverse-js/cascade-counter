import { CascadeCounter } from "./Counter";

export class TokenMap<T> {
  constructor(
    readonly counter: CascadeCounter,
    readonly level: number,
    readonly alphabet: ReadonlyArray<T>
  ) {
    const base = counter.getBaseAt(level);

    if (alphabet.length < base) {
      throw new RangeError(
        `SymbolMap: alphabet too short (${alphabet.length}) for counter base ${base} at level ${level}`
      );
    }
  }

  get symbol(): T {
    return this.alphabet[this.counter.getAt(this.level)];
  }

  getIndex(symbol: T): number {
    const index = this.alphabet.indexOf(symbol);
    if (index === -1) {
      throw new Error(`Symbol '${symbol}' not found in alphabet.`);
    }
    return index;
  }
}