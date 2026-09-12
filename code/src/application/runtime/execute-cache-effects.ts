import type { CacheNamespace } from '../../domain/key/cache-namespace.js';
import type { CacheErrorReporter } from './cache-error-reporter.port.js';
import type { CacheStore } from './cache-store.port.js';
import type { CompiledCacheEffect } from './compiled-policy.types.js';

export class CacheEffectsExecutor {
  public constructor(
    private readonly cache: CacheStore,
    private readonly namespace: CacheNamespace,
    private readonly reporter: CacheErrorReporter,
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
    const operation = effect.kind === 'invalidate' ? 'delete' : 'set';

    try {
      const key = effect.buildCacheKey(this.namespace, args, result);

      if (effect.kind === 'invalidate') {
        await this.cache.delete(key);
      } else {
        await this.cache.set(key, effect.value(args, result), effect.ttl);
      }
    } catch (cause) {
      await this.report({ cause, operation, resource: effect.resource });
    }
  }

  private async report(
    event: Parameters<CacheErrorReporter['report']>[0],
  ): Promise<void> {
    try {
      await this.reporter.report(event);
    } catch {
      // Reporting is observational and must not affect provider behavior.
    }
  }
}
