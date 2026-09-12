import type { StructuredKeyInput } from '../../domain/key/structured-key.types.js';
import type { CacheKey } from '../../domain/key/cache-key.js';
import type { CacheNamespace } from '../../domain/key/cache-namespace.js';
import type { TimeToLive } from '../../domain/policy/time-to-live.js';

export interface RuntimeMutationContext {
  readonly args: readonly unknown[];
  readonly result: unknown;
}

export type RuntimeKeyArgsBuilder = (
  context: RuntimeMutationContext,
) => readonly unknown[];

export type CompiledCacheKeyBuilder = (
  namespace: CacheNamespace,
  args: readonly unknown[],
  result: unknown,
) => CacheKey;

export interface CompiledInvalidationEffect {
  readonly kind: 'invalidate';
  readonly resource: string;
  readonly buildCacheKey: CompiledCacheKeyBuilder;
}

export interface CompiledWriteThroughEffect {
  readonly kind: 'writeThrough';
  readonly resource: string;
  readonly buildCacheKey: CompiledCacheKeyBuilder;
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

export interface RuntimeEffectDefinition {
  readonly keyArgs?: RuntimeKeyArgsBuilder;
  readonly resource: string;
}

export interface RuntimeWriteThroughDefinition extends RuntimeEffectDefinition {
  readonly value: (context: RuntimeMutationContext) => unknown;
}

export type RuntimeCacheEffect =
  | {
      readonly invalidate: RuntimeEffectDefinition;
      readonly writeThrough?: never;
    }
  | {
      readonly invalidate?: never;
      readonly writeThrough: RuntimeWriteThroughDefinition;
    };

export interface RuntimeMethodRule {
  readonly cache?: string;
  readonly effects?: readonly RuntimeCacheEffect[];
}

export type RuntimeResourceMap = Record<string, RuntimeResource>;

export interface RuntimePolicy {
  readonly resources: RuntimeResourceMap;
  readonly methods: Record<string, RuntimeMethodRule>;
}
