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

export enum CacheEffectKind {
  INVALIDATE = 'invalidate',
  WRITE_THROUGH = 'writeThrough',
}

export interface CompiledInvalidationEffect {
  readonly kind: CacheEffectKind.INVALIDATE;
  readonly resource: string;
  readonly buildCacheKey: CompiledCacheKeyBuilder;
}

export interface CompiledWriteThroughEffect {
  readonly kind: CacheEffectKind.WRITE_THROUGH;
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

export interface RuntimeEffectTarget {
  readonly keyArgs?: RuntimeKeyArgsBuilder;
  readonly resource: string;
}

export interface RuntimeWriteThroughTarget extends RuntimeEffectTarget {
  readonly value: (context: RuntimeMutationContext) => unknown;
}

export interface RuntimeInvalidationEffect {
  readonly invalidate: RuntimeEffectTarget;
  readonly writeThrough?: never;
}

export interface RuntimeWriteThroughEffect {
  readonly invalidate?: never;
  readonly writeThrough: RuntimeWriteThroughTarget;
}

export type RuntimeCacheEffect =
  RuntimeInvalidationEffect | RuntimeWriteThroughEffect;

export interface RuntimeMethodRule {
  readonly cache?: string;
  readonly effects?: readonly RuntimeCacheEffect[];
}

export type RuntimeResourceMap = Record<string, RuntimeResource>;

export interface RuntimePolicy {
  readonly resources: RuntimeResourceMap;
  readonly methods: Record<string, RuntimeMethodRule>;
}
