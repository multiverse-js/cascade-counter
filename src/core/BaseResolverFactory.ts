import { mapNonEmpty } from "./MiscUtils";

import type {
  BaseRules,
  ValidateOptions,
  BaseResolver,
  PartialBaseResolver,
  NamedBaseResolver,
  AnyResolverInput,
  NonEmptyReadonlyArray
} from "./types";

import {
  assertBaseRuleValid,
  assertSafeIntegerInRangeInclusive
} from "./AssertUtils";

function createBaseResolver(
  rules: NonEmptyReadonlyArray<BaseRules>,
  { validate = true }: ValidateOptions = {}
): BaseResolver {

  if (validate) {
    rules.forEach((rule, i) => assertBaseRuleValid("createPartialBaseResolver", i, rule));
  }
  return (level, v) => {
    const rule = rules[level];
    // Evaluate function if needed in order to extract the base
    if (rule === undefined) {
      throw new Error(`createBaseResolver(): missing rule for level ${level}`);
    }
    return typeof rule === "number" ? rule : rule(v);
  };
}

function createNamedBaseResolver<const T extends NonEmptyReadonlyArray<string>>(
  order: T,
  rules: Record<T[number], BaseRules>,
  { validate = true }: ValidateOptions = {}
): NamedBaseResolver<T> {

  if (validate) for (const key of order) if (!(key in rules)) {
    throw new Error(`createNamedBaseResolver(): missing '${key}'`);
  }
  const resolverFor = <K extends T[number]>(key: K) => rules[key];
  const rulesFinal = mapNonEmpty(order, resolverFor);

  return {
    names: order,
    indexOf: (name: T[number]) => {
      const i = order.indexOf(name);
      if (i < 0) throw new Error(`createNamedBaseResolver(): Unknown level '${name}'`);
      return i;
    },
    resolver: createBaseResolver(rulesFinal, { validate })
  };
}

function createPartialBaseResolver(
  rules: Partial<Record<number, BaseRules>>,
  { validate = false }: ValidateOptions = {}
): PartialBaseResolver {

  if (validate) {
    for (const [key, rule] of Object.entries(rules)) {
      if (rule === undefined) continue;
      assertBaseRuleValid("createPartialBaseResolver", key, rule);
    }
  }
  return (level, v) => {
    const rule = rules[level];
    if (rule === undefined) return undefined;
    return typeof rule === "number" ? rule : rule(v);
  };
}

function chainBaseResolvers<T extends ReadonlyArray<string> = ReadonlyArray<string>>(
  ...providers: NonEmptyReadonlyArray<AnyResolverInput<T>>
): BaseResolver {

  const resolvers: ReadonlyArray<BaseResolver | PartialBaseResolver> = providers.map(
    (p) => (typeof p === "function" ? p : p.resolver) // Normalize all inputs to callables
  );
  return (level, v) => {
    for (const r of resolvers) {
      const result = r(level, v);
      if (result !== undefined) return result;
    }
    throw new Error(`chainBaseResolvers(): no provider for level ${level}`);
  };
}

function enforceBaseResolverLevels(
  resolver: BaseResolver,
  expectedLevels: number
): BaseResolver {

  return (index, values) => {
    assertSafeIntegerInRangeInclusive(
      "enforceBaseResolverLevels",
      "level",
      index, 0, expectedLevels - 1
    );
    return resolver(index, values);
  };
}

export const Resolvers = Object.freeze({
  create: createBaseResolver,
  createNamed: createNamedBaseResolver,
  createPartial: createPartialBaseResolver,
  chain: chainBaseResolvers,
  enforceLevels: enforceBaseResolverLevels,
});