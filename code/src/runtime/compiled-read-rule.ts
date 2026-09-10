import type { StructuredKeyInput } from '../key/structured-key.types.js';
import { CacheKey } from '../key/cache-key.js';
import { CacheKeyVersion } from '../key/cache-key-version.js';
import { CacheNamespace } from '../key/cache-namespace.js';
import { CacheResourceName } from '../key/cache-resource-name.js';
import { TimeToLive } from '../policy/time-to-live.js';

export class CompiledReadRule {
  public constructor(
    public readonly resource: CacheResourceName,
    public readonly version: CacheKeyVersion,
    public readonly ttl: TimeToLive,
    private readonly keyBuilder: (
      args: readonly unknown[],
    ) => StructuredKeyInput,
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
}
