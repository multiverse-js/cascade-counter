export class Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(v: Vector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  toArray(): number[] {
    return [this.x, this.y, this.z];
  }

  static toArrays(vectors: readonly Vector3[]): number[][] {
    return vectors.map(v => v.toArray());
  }

  // ... other ops

  // cardinal directions
  static readonly up = Object.freeze(new Vector3(0, 1, 0));
  static readonly down = Object.freeze(new Vector3(0, -1, 0));
  static readonly left = Object.freeze(new Vector3(-1, 0, 0));
  static readonly right = Object.freeze(new Vector3(1, 0, 0));
  static readonly forward = Object.freeze(new Vector3(0, 0, 1));
  static readonly back = Object.freeze(new Vector3(0, 0, -1));

  // diagonals (optional)
  // 26 neighbors if you're doing voxel/grids
}