import type { StructuredKeyInput } from './structured-key.types.js';

/** Identifies an application environment in the cache-key namespace. */
export interface CacheKeyNamespace {
  readonly application: string;
  readonly environment: string;
}

/** Input required to build one deterministic cache key. */
export interface BuildCacheKeyInput {
  readonly namespace: CacheKeyNamespace;
  readonly resource: string;
  readonly version: number;
  readonly input: StructuredKeyInput;
}
