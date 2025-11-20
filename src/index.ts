export * from "./core/Counter";
export * from "./core/AxisUtils";

export { Resolvers } from "./core/BaseResolverFactory";

export type {
  CascadeCounterOptions,
  WrapPolicy,
  IterateDirection,
  BaseResolver,
  NamedBaseResolver,
  PartialBaseResolver,
  BaseRules
} from "./core/types";

export * from "./space/Space";
export * from "./space/Distance";
export * from "./space/Vector";

export type {
  Coord,
  CoordPredicate,
  NeighborhoodKind,
  FloodMode
} from "./space/types";