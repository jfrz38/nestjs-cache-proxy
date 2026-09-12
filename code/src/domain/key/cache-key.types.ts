import type { StructuredKeyInput } from './structured-key.types.js';

export interface CacheKeyNamespace {
  readonly application: string;
  readonly environment: string;
}

export interface BuildCacheKeyInput {
  readonly namespace: CacheKeyNamespace;
  readonly resource: string;
  readonly version: number;
  readonly input: StructuredKeyInput;
}
