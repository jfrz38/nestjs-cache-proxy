import { CacheNamespace } from '../../domain/key/cache-namespace.js';
import { CacheOperations } from './cache-operations.js';
import type { CompiledReadRule } from './compiled-read-rule.js';

export class CacheAsideExecutor {
  public constructor(
    private readonly cache: CacheOperations,
    private readonly namespace: CacheNamespace,
  ) {}

  public async execute<Result>(
    rule: CompiledReadRule,
    args: readonly unknown[],
    invoke: () => Result | Promise<Result>,
  ): Promise<Result> {
    const key = rule.buildCacheKey(this.namespace, args);

    try {
      const value = await this.cache.get<Result>(rule.resource.value, key);

      if (value !== undefined) {
        return value;
      }
    } catch {
      // CacheOperations is fail-open. This preserves that property for custom implementations.
    }

    const result = await invoke();

    await this.cache.set(rule.resource.value, key, result, rule.ttl, () =>
      rule.shouldCache(args, result),
    );

    return result;
  }
}
