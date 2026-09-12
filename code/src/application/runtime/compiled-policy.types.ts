import type { StructuredKeyInput } from '../../domain/key/structured-key.types.js';
import type { CacheKey } from '../../domain/key/cache-key.js';
import type { CacheNamespace } from '../../domain/key/cache-namespace.js';
import type { TimeToLive } from '../../domain/policy/time-to-live.js';

export interface CompiledInvalidationEffect {
  readonly kind: 'invalidate';
  readonly resource: string;
  readonly buildCacheKey: (
    namespace: CacheNamespace,
    args: readonly unknown[],
    result: unknown,
  ) => CacheKey;
}

export interface CompiledWriteThroughEffect {
  readonly kind: 'writeThrough';
  readonly resource: string;
  readonly buildCacheKey: (
    namespace: CacheNamespace,
    args: readonly unknown[],
    result: unknown,
  ) => CacheKey;
  readonly ttl: TimeToLive;
  readonly value: (args: readonly unknown[], result: unknown) => unknown;
}

export type CompiledCacheEffect =
  CompiledInvalidationEffect | CompiledWriteThroughEffect;

export interface RuntimeResource {
  readonly key: (args: readonly unknown[]) => StructuredKeyInput;
  readonly ttl: number;
  readonly version: number;
}

export interface RuntimeCacheEffect {
  readonly invalidate?: {
    readonly keyArgs?: (context: {
      readonly args: readonly unknown[];
      readonly result: unknown;
    }) => readonly unknown[];
    readonly resource: string;
  };
  readonly writeThrough?: {
    readonly keyArgs?: (context: {
      readonly args: readonly unknown[];
      readonly result: unknown;
    }) => readonly unknown[];
    readonly resource: string;
    readonly value: (context: {
      readonly args: readonly unknown[];
      readonly result: unknown;
    }) => unknown;
  };
}

export interface RuntimePolicy {
  readonly resources: Record<string, RuntimeResource>;
  readonly methods: Record<
    string,
    {
      readonly cache?: string;
      readonly effects?: readonly RuntimeCacheEffect[];
    }
  >;
}
