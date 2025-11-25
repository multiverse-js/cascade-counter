export class Vector2 {
  readonly x: number;
  readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  scale(n: number): Vector2 {
    return new Vector2(this.x * n, this.y * n);
  }

  equals(v: Vector2): boolean {
    return this.x === v.x && this.y === v.y;
  }

  toArray(): number[] {
    return [this.x, this.y];
  }

  static toArrays(vectors: readonly Vector2[]): number[][] {
    return vectors.map(v => v.toArray());
  }

  // ---- STATIC CONSTANTS ----
  static readonly zero = Object.freeze(new Vector2(0, 0));

  static readonly up = Object.freeze(new Vector2(0, -1));
  static readonly down = Object.freeze(new Vector2(0, 1));
  static readonly left = Object.freeze(new Vector2(-1, 0));
  static readonly right = Object.freeze(new Vector2(1, 0));

  static readonly upLeft = Object.freeze(new Vector2(-1, -1));
  static readonly upRight = Object.freeze(new Vector2(1, -1));
  static readonly downLeft = Object.freeze(new Vector2(-1, 1));
  static readonly downRight = Object.freeze(new Vector2(1, 1));

  static readonly cardinals = [
    Vector2.up, Vector2.down, Vector2.left, Vector2.right
  ] as const;

  static readonly diagonals = [
    Vector2.upLeft, Vector2.upRight, Vector2.downLeft, Vector2.downRight
  ] as const;

  static readonly quadrants = [
    Vector2.down, Vector2.right, Vector2.upRight, Vector2.downRight
  ] as const;

  static readonly positives = [
    Vector2.down, Vector2.right, Vector2.downRight
  ] as const;

  static readonly all = [
    ...Vector2.cardinals,
    ...Vector2.diagonals
  ] as const;
}