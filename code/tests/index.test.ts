import { describe, expect, it } from 'vitest';

import {
  defineCachePolicy,
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
});
