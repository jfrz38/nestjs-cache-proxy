import { buildCacheKey } from '../domain/key/build-cache-key.js';
import type { CacheKeyNamespace } from '../domain/key/cache-key.types.js';
import type {
  CachePolicy,
  CacheResource,
  MethodArgs,
  PromiseMethodName,
} from '../domain/policy/policy.types.js';

type PolicyResourceArgs<T, Resource> =
  Resource extends CacheResource<T, infer Method>
    ? MethodArgs<T, Method>
    : never;

export interface BuildPolicyCacheKeyInput<
  T,
  Resources extends Record<string, unknown>,
  Name extends Extract<keyof Resources, string>,
> {
  readonly args: PolicyResourceArgs<T, Resources[Name]>;
  readonly namespace: CacheKeyNamespace;
  readonly policy: CachePolicy<T, Resources>;
  readonly resource: Name;
}

export function buildPolicyCacheKey<
  T,
  Resources extends Record<string, unknown>,
  Name extends Extract<keyof Resources, string>,
>({
  args,
  namespace,
  policy,
  resource,
}: BuildPolicyCacheKeyInput<T, Resources, Name>): string {
  const definition = policy.resources[resource] as CacheResource<
    T,
    PromiseMethodName<T>
  >;

  return buildCacheKey({
    input: definition.key(args),
    namespace,
    resource,
    version: definition.version,
  });
}
