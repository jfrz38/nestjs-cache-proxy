import type { StructuredKeyInput } from '../key/structured-key.types.js';
import { CacheKey } from '../key/cache-key.js';
import { CacheKeyVersion } from '../key/cache-key-version.js';
import { CacheNamespace } from '../key/cache-namespace.js';
import { CacheResourceName } from '../key/cache-resource-name.js';
import { TimeToLive } from '../policy/time-to-live.js';

/** Immutable read rule that can build only validated cache keys. */
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

/** Immutable runtime view of the read rules in one validated policy. */
export class CompiledCachePolicy {
  private readonly reads: ReadonlyMap<string, CompiledReadRule>;

  public constructor(reads: ReadonlyMap<string, CompiledReadRule>) {
    this.reads = new Map(reads);
  }

  public readRuleFor(method: string): CompiledReadRule | undefined {
    return this.reads.get(method);
  }
}
