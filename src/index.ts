export * from "./soul/Counter";
export * from "./soul/Axis";

export { Resolvers } from "./soul/BaseResolverFactory";

export type {
  CascadeCounterOptions,
  WrapPolicy,
  IterateDirection,
  BaseResolver,
  NamedBaseResolver,
  PartialBaseResolver,
  BaseRules
} from "./soul/types";

export * from "./space/Space";
export * from "./space/Distance";
export * from "./space/Vector";

export type {
  Coord,
  CoordPredicate,
  NeighborhoodKind,
  FloodMode
} from "./space/types";