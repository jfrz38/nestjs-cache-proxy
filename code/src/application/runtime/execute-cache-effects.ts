import type { CacheNamespace } from '../../domain/key/cache-namespace.js';
import { CacheOperations } from './cache-operations.js';
import {
  CacheEffectKind,
  type CompiledCacheEffect,
} from './compiled-policy.types.js';

export class CacheEffectsExecutor {
  public constructor(
    private readonly cache: CacheOperations,
    private readonly namespace: CacheNamespace,
  ) {}

  public async execute(
    effects: readonly CompiledCacheEffect[],
    args: readonly unknown[],
    result: unknown,
  ): Promise<void> {
    for (const effect of effects) {
      await this.executeEffect(effect, args, result);
    }
  }

  private async executeEffect(
    effect: CompiledCacheEffect,
    args: readonly unknown[],
    result: unknown,
  ): Promise<void> {
    try {
      const key = effect.buildCacheKey(this.namespace, args, result);

      if (effect.kind === CacheEffectKind.INVALIDATE) {
        await this.cache.delete(effect.resource, key);
      } else {
        await this.cache.set(
          effect.resource,
          key,
          effect.value(args, result),
          effect.ttl,
        );
      }
    } catch {
      // Key derivation failures are policy failures and preserve the existing fail-open effect behavior.
    }
  }
}
