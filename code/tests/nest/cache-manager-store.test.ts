import type { Cache } from 'cache-manager';
import { describe, expect, it, vi } from 'vitest';

import { CacheKey } from '../../src/key/cache-key.js';
import { CacheKeyVersion } from '../../src/key/cache-key-version.js';
import { CacheNamespace } from '../../src/key/cache-namespace.js';
import { CacheResourceName } from '../../src/key/cache-resource-name.js';
import { CacheManagerStore } from '../../src/nest/cache-manager-store.js';
import { TimeToLive } from '../../src/policy/time-to-live.js';

describe('CacheManagerStore', () => {
  it('maps cache keys and TTLs to cache-manager primitives', async () => {
    const cacheManager = {
      get: vi.fn().mockResolvedValue('cached'),
      set: vi.fn().mockResolvedValue(undefined),
    } as unknown as Cache;
    const key = CacheKey.create({
      input: 'user-1',
      namespace: CacheNamespace.from({
        application: 'users-api',
        environment: 'test',
      }),
      resource: CacheResourceName.from('userById'),
      version: CacheKeyVersion.from(1),
    });
    const ttl = TimeToLive.fromMilliseconds(60_000);
    const store = new CacheManagerStore(cacheManager);

    await expect(store.get(key)).resolves.toBe('cached');
    await store.set(key, { id: 'user-1' }, ttl);

    expect(cacheManager.get).toHaveBeenCalledWith(key.value);
    expect(cacheManager.set).toHaveBeenCalledWith(
      key.value,
      { id: 'user-1' },
      ttl.milliseconds,
    );
  });
});
