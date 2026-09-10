import type { CacheKey } from '../key/cache-key.js';
import type { TimeToLive } from '../policy/time-to-live.js';

/** Minimal cache capability required by the framework-independent runtime. */
export interface CacheStore {
  get(key: CacheKey): Promise<unknown>;
  set(key: CacheKey, value: unknown, ttl: TimeToLive): Promise<void>;
}
