import type { CacheKey } from '../../domain/key/cache-key.js';
import type { TimeToLive } from '../../domain/policy/time-to-live.js';

export interface CacheStore {
  get(key: CacheKey): Promise<unknown>;
  set(key: CacheKey, value: unknown, ttl: TimeToLive): Promise<void>;
}
