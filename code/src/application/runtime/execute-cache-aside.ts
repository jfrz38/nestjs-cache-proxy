import { CacheNamespace } from '../../domain/key/cache-namespace.js';
import type { CacheStore } from './cache-store.port.js';
import type { CompiledReadRule } from './compiled-read-rule.js';

export class CacheAsideExecutor {
  public constructor(
    private readonly cache: CacheStore,
    private readonly namespace: CacheNamespace,
  ) {}

  public async execute<Result>(
    rule: CompiledReadRule,
    args: readonly unknown[],
    invoke: () => Result | Promise<Result>,
  ): Promise<Result> {
    const key = rule.buildCacheKey(this.namespace, args);

    try {
      const value = await this.cache.get(key);

      // Until the iteration 08 envelope, null and undefined are backend misses.
      if (value !== undefined && value !== null) {
        return value as Result;
      }
    } catch {
      // A cache read failure is deliberately equivalent to a miss.
    }

    const result = await invoke();

    if (result !== undefined && result !== null) {
      try {
        await this.cache.set(key, result, rule.ttl);
      } catch {
        // A cache write failure must not replace the provider result.
      }
    }

    return result;
  }
}
