import type { StructuredKeyInput } from '../../domain/key/structured-key.types.js';
import { CacheKey } from '../../domain/key/cache-key.js';
import { CacheKeyVersion } from '../../domain/key/cache-key-version.js';
import { CacheNamespace } from '../../domain/key/cache-namespace.js';
import { CacheResourceName } from '../../domain/key/cache-resource-name.js';
import { TimeToLive } from '../../domain/policy/time-to-live.js';

export class CompiledReadRule {
  public constructor(
    public readonly resource: CacheResourceName,
    public readonly version: CacheKeyVersion,
    public readonly ttl: TimeToLive,
    private readonly keyBuilder: (
      args: readonly unknown[],
    ) => StructuredKeyInput,
    private readonly cacheIf:
      | ((context: {
          readonly args: readonly unknown[];
          readonly result: unknown;
        }) => boolean)
      | undefined,
  ) {}

  public buildCacheKey(
    namespace: CacheNamespace,
    args: readonly unknown[],
  ): CacheKey {
    return CacheKey.create({
      input: this.keyBuilder(args),
      namespace,
      resource: this.resource,
      version: this.version,
    });
  }

  public shouldCache(args: readonly unknown[], result: unknown): boolean {
    return this.cacheIf?.({ args, result }) ?? true;
  }
}
