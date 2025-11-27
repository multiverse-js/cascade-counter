export type TimelineMode = "full" | "patch" | "hybrid";

export type Patch2D<T> = {
  x: number;
  y: number;
  value: T;
}

export type Patch3D<T> = {
  x: number;
  y: number;
  z: number;
  value: T;
}