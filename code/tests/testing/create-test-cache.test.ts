import { describe, expect, it } from 'vitest';

import { CacheEnvelope } from '../../src/application/runtime/cache-envelope.js';
import {
  createTestCache,
  TestCacheOperationType,
} from '../../src/testing/index.js';

describe('createTestCache', () => {
  it('expires entries exactly at their deterministic TTL boundary', async () => {
    const testCache = createTestCache();

    await testCache.cache.set('user:1', 'Ada', 1_000);
    testCache.clock.advanceBy(999);
    await expect(testCache.cache.get('user:1')).resolves.toBe('Ada');
    testCache.clock.advanceBy(1);
    await expect(testCache.cache.get('user:1')).resolves.toBeUndefined();

    expect(testCache.operations()).toEqual([
      expect.objectContaining({
        key: 'user:1',
        ttl: 1_000,
        type: TestCacheOperationType.SET,
      }),
      expect.objectContaining({
        hit: true,
        key: 'user:1',
        type: TestCacheOperationType.GET,
      }),
      expect.objectContaining({
        hit: false,
        key: 'user:1',
        type: TestCacheOperationType.GET,
      }),
    ]);
  });

  it('records logical cache values without exposing the runtime envelope', async () => {
    const testCache = createTestCache();

    await testCache.cache.set('user:1', CacheEnvelope.encode(null), 1_000);
    await testCache.cache.set('user:2', CacheEnvelope.encode(false), 1_000);
    await testCache.seed('user:3', { id: '3' }, 1_000);

    await expect(testCache.cache.get('user:3')).resolves.toEqual(
      CacheEnvelope.encode({ id: '3' }),
    );
    expect(testCache.entries()).toEqual([
      { expiresAt: 1_000, key: 'user:1', value: null },
      { expiresAt: 1_000, key: 'user:2', value: false },
      { expiresAt: 1_000, key: 'user:3', value: { id: '3' } },
    ]);
    expect(testCache.operations()[0]).toMatchObject({
      type: TestCacheOperationType.SET,
      value: null,
    });
    expect(testCache.operations()[1]).toMatchObject({
      type: TestCacheOperationType.SET,
      value: false,
    });
    expect(testCache.operations()[2]).toMatchObject({
      type: TestCacheOperationType.SET,
      value: { id: '3' },
    });
  });

  it('does not seed undefined values because the runtime does not cache them', async () => {
    const testCache = createTestCache();

    await testCache.seed('user:1', undefined, 1_000);

    expect(testCache.entries()).toEqual([]);
    expect(testCache.operations()).toEqual([]);
  });

  it('returns immutable detached inspection snapshots and resets all state', async () => {
    const testCache = createTestCache({ initialTime: 100 });
    await testCache.cache.set('user:1', { profile: { name: 'Ada' } }, 1_000);
    const entries = testCache.entries();
    const operations = testCache.operations();

    expect(Object.isFrozen(entries)).toBe(true);
    expect(Object.isFrozen(entries[0])).toBe(true);
    expect(Object.isFrozen(entries[0]?.value)).toBe(true);
    expect(Object.isFrozen(operations)).toBe(true);
    expect(() => {
      (entries[0]?.value as { profile: { name: string } }).profile.name =
        'Grace';
    }).toThrow();
    expect(testCache.entries()[0]?.value).toEqual({ profile: { name: 'Ada' } });

    testCache.clock.advanceBy(1);
    testCache.reset();

    expect(testCache.clock.now).toBe(0);
    expect(testCache.entries()).toEqual([]);
    expect(testCache.operations()).toEqual([]);
  });

  it('rejects invalid clock values', () => {
    const testCache = createTestCache();

    expect(() => testCache.clock.advanceBy(-1)).toThrow(
      'non-negative safe integer',
    );
    expect(() => createTestCache({ initialTime: 1.5 })).toThrow(
      'non-negative safe integer',
    );
  });
});
