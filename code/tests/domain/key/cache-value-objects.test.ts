import { describe, expect, it } from 'vitest';

import { CacheKey } from '../../../src/domain/key/cache-key.js';
import { CacheKeyVersion } from '../../../src/domain/key/cache-key-version.js';
import { CacheNamespace } from '../../../src/domain/key/cache-namespace.js';
import { CacheResourceName } from '../../../src/domain/key/cache-resource-name.js';
import {
  InvalidCacheKeyNamespaceError,
  InvalidCacheKeyResourceError,
  InvalidCacheKeyVersionError,
} from '../../../src/domain/key/cache-key-validation-error.js';
import {
  InvalidTimeToLiveError,
  TimeToLive,
} from '../../../src/domain/policy/time-to-live.js';

describe('internal cache value objects', () => {
  it('accepts valid values without normalizing persisted key components', () => {
    const namespace = CacheNamespace.from({
      application: ' users-api ',
      environment: 'test',
    });
    const resource = CacheResourceName.from(' userById ');
    const version = CacheKeyVersion.from(1);
    const ttl = TimeToLive.fromMilliseconds(60_000);

    expect(namespace.application).toBe(' users-api ');
    expect(resource.value).toBe(' userById ');
    expect(version.value).toBe(1);
    expect(ttl.milliseconds).toBe(60_000);
    expect(
      CacheKey.create({ input: 'user-1', namespace, resource, version }).value,
    ).toContain('"resource":" userById "');
  });

  it.each([
    [() => CacheNamespace.from(null as never), InvalidCacheKeyNamespaceError],
    [() => CacheResourceName.from(' '), InvalidCacheKeyResourceError],
    [() => CacheKeyVersion.from(0), InvalidCacheKeyVersionError],
    [() => TimeToLive.fromMilliseconds(1.5), InvalidTimeToLiveError],
  ])('rejects invalid value object input', (create, error) => {
    expect(create).toThrow(error);
  });
});
