export * from "./core/Counter";

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

export * from "./space/Axis";
export * from "./space/Distance";
export * from "./space/Space";

export type {
  Coord,
  CoordPredicate,
  NeighborhoodKind,
  FloodMode
} from "./space/types";