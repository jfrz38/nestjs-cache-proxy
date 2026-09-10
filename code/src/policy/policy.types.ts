import type { StructuredKeyInput } from '../key/structured-key.types.js';

export type { StructuredKeyInput } from '../key/structured-key.types.js';

export type PromiseMethodName<T> = {
  [K in keyof T]-?: T[K] extends (...args: infer _Args) => Promise<unknown>
    ? K extends string
      ? K
      : never
    : never;
}[keyof T];

export type MethodArgs<T, K extends PromiseMethodName<T>> = T[K] extends (
  ...args: infer Args
) => Promise<unknown>
  ? Args
  : never;

export type MethodResult<T, K extends PromiseMethodName<T>> = T[K] extends (
  ...args: never
) => Promise<infer Result>
  ? Awaited<Result>
  : never;

export interface CacheResource<T, K extends PromiseMethodName<T>> {
  readonly method: K;
  readonly version: number;
  readonly ttl: number;
  readonly key: (args: NoInfer<MethodArgs<T, K>>) => StructuredKeyInput;
}

export type CacheResourceMap<T> = Record<
  string,
  {
    [K in PromiseMethodName<T>]: CacheResource<T, K>;
  }[PromiseMethodName<T>]
>;

type ResourceName<Resources> = Extract<keyof Resources, string>;

type ResourceArgsFor<T, Resource> =
  Resource extends CacheResource<T, infer Method>
    ? MethodArgs<T, Method>
    : never;

type ResourceResultFor<T, Resource> =
  Resource extends CacheResource<T, infer Method>
    ? MethodResult<T, Method>
    : never;

type ResourceArgs<
  T,
  Resources,
  Name extends ResourceName<Resources>,
> = ResourceArgsFor<T, Resources[Name]>;

type ResourceResult<
  T,
  Resources,
  Name extends ResourceName<Resources>,
> = ResourceResultFor<T, Resources[Name]>;

type CacheReadRuleFor<Resources> = CacheReadRule<ResourceName<Resources>>;

type ReadRule<Resources> = CacheReadRuleFor<Resources>;

export interface CacheReadRule<Resource extends string> {
  readonly cache: Resource;
}

export interface MutationContext<Args extends readonly unknown[], Result> {
  readonly args: Readonly<Args>;
  readonly result: Result;
}

type MutationContextFor<
  T,
  Method extends PromiseMethodName<T>,
> = MutationContext<MethodArgs<T, Method>, MethodResult<T, Method>>;

export type CacheEffect<
  T,
  MutationMethod extends PromiseMethodName<T>,
  Resources,
> = {
  [Name in ResourceName<Resources>]:
    | {
        readonly invalidate: {
          readonly resource: Name;
          readonly keyArgs: (
            context: MutationContextFor<T, MutationMethod>,
          ) => ResourceArgs<T, Resources, Name>;
        };
      }
    | {
        readonly writeThrough: {
          readonly resource: Name;
          readonly keyArgs: (
            context: MutationContextFor<T, MutationMethod>,
          ) => ResourceArgs<T, Resources, Name>;
          readonly value: (
            context: MutationContextFor<T, MutationMethod>,
          ) => ResourceResult<T, Resources, Name>;
        };
      };
}[ResourceName<Resources>];

export type CacheWriteThroughEffect<
  T,
  MutationMethod extends PromiseMethodName<T>,
  Resources,
> = Extract<
  CacheEffect<T, MutationMethod, Resources>,
  { readonly writeThrough: unknown }
>;

type CacheMutationRule<Effect> = {
  readonly effects: readonly [Effect, ...Effect[]];
};

type MethodRule<T, Method extends PromiseMethodName<T>, Resources> =
  ReadRule<Resources> | CacheMutationRule<CacheEffect<T, Method, Resources>>;

export type CachePolicyMethods<T, Resources> = Partial<{
  readonly [Method in PromiseMethodName<T>]: MethodRule<T, Method, Resources>;
}>;

export interface CachePolicy<
  T,
  Resources extends Record<string, unknown> = CacheResourceMap<T>,
> {
  readonly resources: Resources & CacheResourceMap<T>;
  readonly methods: CachePolicyMethods<T, Resources>;
}
