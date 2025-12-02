export type Coord = ReadonlyArray<number>;
export type CoordFn = (coord: Coord) => void;
export type CoordPredicate = (coord: Coord) => boolean;
export type DistanceFn = (a: Coord, b: Coord) => number;

export type Offset = ReadonlyArray<number>;
export type NeighborhoodKind = "vonNeumann" | "moore";
export type FloodMode = "bfs" | "dfs";

export type EntityId = number;