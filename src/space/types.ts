export type Coord = ReadonlyArray<number>;
export type CoordFn = (coord: Coord) => void;
export type CoordPredicate = (coord: Coord) => boolean;
export type DistanceFn = (a: Coord, b: Coord) => number;