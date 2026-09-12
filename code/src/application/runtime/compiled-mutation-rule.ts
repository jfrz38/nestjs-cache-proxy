import type { CompiledCacheEffect } from './compiled-policy.types.js';

export class CompiledMutationRule {
  public constructor(public readonly effects: readonly CompiledCacheEffect[]) {}
}
