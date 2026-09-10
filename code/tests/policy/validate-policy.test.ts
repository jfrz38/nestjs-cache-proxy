import { describe, expect, it } from 'vitest';

import {
  InvalidCachePolicyError,
  validateCachePolicy,
} from '../../src/policy/validate-policy.js';

const validPolicy = {
  resources: {
    userById: {
      method: 'findById',
      version: 1,
      ttl: 60_000,
      key: () => 'user',
    },
  },
  methods: {
    findById: { cache: 'userById' },
    update: {
      effects: [
        {
          writeThrough: {
            resource: 'userById',
            keyArgs: () => ['user'],
            value: () => ({ id: 'user' }),
          },
        },
      ],
    },
  },
};

describe('validateCachePolicy', () => {
  it('accepts a structurally valid policy', () => {
    expect(() => validateCachePolicy(validPolicy)).not.toThrow();
  });

  it.each([
    [
      'an empty resource name',
      { ...validPolicy, resources: { '': validPolicy.resources.userById } },
    ],
    [
      'a non-positive TTL',
      {
        ...validPolicy,
        resources: {
          userById: { ...validPolicy.resources.userById, ttl: 0 },
        },
      },
    ],
    [
      'an unsafe version',
      {
        ...validPolicy,
        resources: {
          userById: {
            ...validPolicy.resources.userById,
            version: Number.MAX_SAFE_INTEGER + 1,
          },
        },
      },
    ],
    [
      'an unknown read resource',
      {
        ...validPolicy,
        methods: { findById: { cache: 'missing' } },
      },
    ],
    [
      'a rule with cache and effects',
      {
        ...validPolicy,
        methods: { findById: { cache: 'userById', effects: [] } },
      },
    ],
    [
      'an empty effects list',
      {
        ...validPolicy,
        methods: { update: { effects: [] } },
      },
    ],
    [
      'an effect with both discriminants',
      {
        ...validPolicy,
        methods: {
          update: {
            effects: [
              {
                invalidate: {
                  resource: 'userById',
                  keyArgs: () => ['user'],
                },
                writeThrough: {
                  resource: 'userById',
                  keyArgs: () => ['user'],
                  value: () => ({ id: 'user' }),
                },
              },
            ],
          },
        },
      },
    ],
  ])('rejects %s', (_scenario, policy) => {
    expect(() => validateCachePolicy(policy)).toThrow(InvalidCachePolicyError);
  });

  it('does not expose values from an invalid policy', () => {
    const secret = 'do-not-disclose';

    expect(() =>
      validateCachePolicy({
        resources: {
          userById: {
            method: 'findById',
            version: 1,
            ttl: 1,
            key: secret,
          },
        },
        methods: {},
      }),
    ).toThrowError('Resource "userById" must declare a key builder.');

    try {
      validateCachePolicy({
        resources: {
          userById: {
            method: 'findById',
            version: 1,
            ttl: 1,
            key: secret,
          },
        },
        methods: {},
      });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
