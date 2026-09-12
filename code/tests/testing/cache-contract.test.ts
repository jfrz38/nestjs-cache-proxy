import { describe, expect, it } from 'vitest';

import { buildCacheKey, defineCachePolicy } from '../../src/index.js';
import { buildPolicyCacheKey } from '../../src/testing/index.js';

interface UserRepository {
  findById(id: string): Promise<{ readonly id: string }>;
}

describe('buildPolicyCacheKey', () => {
  it('derives the public production key from a typed policy resource', () => {
    const policy = defineCachePolicy<UserRepository>()({
      resources: {
        userById: {
          key: ([id]) => ({ id }),
          method: 'findById',
          ttl: 1_000,
          version: 1,
        },
      },
      methods: { findById: { cache: 'userById' } },
    });

    expect(
      buildPolicyCacheKey({
        args: ['user-1'],
        namespace: { application: 'users-api', environment: 'test' },
        policy,
        resource: 'userById',
      }),
    ).toBe(
      buildCacheKey({
        input: { id: 'user-1' },
        namespace: { application: 'users-api', environment: 'test' },
        resource: 'userById',
        version: 1,
      }),
    );
  });
});
