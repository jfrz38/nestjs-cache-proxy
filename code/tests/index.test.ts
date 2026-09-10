import { describe, expect, it } from 'vitest';

import {
  buildCacheKey,
  CacheKeyValidationError,
  defineCachePolicy,
  InvalidCacheKeyInputError,
  InvalidCacheKeyNamespaceError,
  InvalidCacheKeyResourceError,
  InvalidCacheKeyVersionError,
  InvalidCachePolicyError,
  validateCachePolicy,
} from '../src/index.js';

interface UserRepository {
  findById(id: string): Promise<{ id: string } | null>;
}

describe('package entry point', () => {
  it('exports the typed policy API', () => {
    const policy = defineCachePolicy<UserRepository>()({
      resources: {
        userById: {
          method: 'findById',
          version: 1,
          ttl: 60_000,
          key: ([id]) => id,
        },
      },
      methods: {
        findById: { cache: 'userById' },
      },
    });

    expect(policy.resources.userById.ttl).toBe(60_000);
  });

  it('exports the runtime policy validator', () => {
    expect(() => validateCachePolicy(null)).toThrow(InvalidCachePolicyError);
  });

  it('exports the cache-key contract', () => {
    expect(
      buildCacheKey({
        namespace: { application: 'users-api', environment: 'test' },
        resource: 'userById',
        version: 1,
        input: 'user-1',
      }),
    ).toContain('ncp:k1:');
    expect(CacheKeyValidationError).toBeTypeOf('function');
    expect(InvalidCacheKeyNamespaceError).toBeTypeOf('function');
    expect(InvalidCacheKeyResourceError).toBeTypeOf('function');
    expect(InvalidCacheKeyVersionError).toBeTypeOf('function');
    expect(InvalidCacheKeyInputError).toBeTypeOf('function');
  });
});
