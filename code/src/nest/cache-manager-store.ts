import type { Cache } from 'cache-manager';

import type { CacheStore } from '../runtime/cache-store.port.js';
import type { CacheKey } from '../key/cache-key.js';
import type { TimeToLive } from '../policy/time-to-live.js';

export class CacheManagerStore implements CacheStore {
  public constructor(private readonly cacheManager: Cache) {}

  public get(key: CacheKey): Promise<unknown> {
    return this.cacheManager.get(key.value);
  }

  public async set(
    key: CacheKey,
    value: unknown,
    ttl: TimeToLive,
  ): Promise<void> {
    await this.cacheManager.set(key.value, value, ttl.milliseconds);
  }
}
