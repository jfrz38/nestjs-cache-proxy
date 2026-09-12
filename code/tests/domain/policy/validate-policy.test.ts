import { describe, expect, it } from 'vitest';

import { InvalidCachePolicyError } from '../../../src/domain/policy/invalid-cache-policy-error.js';
import { validateCachePolicy } from '../../../src/domain/policy/validate-policy.js';

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
      'Resource names must not be empty.',
    ],
    [
      'a non-positive TTL',
      {
        ...validPolicy,
        resources: {
          userById: { ...validPolicy.resources.userById, ttl: 0 },
        },
      },
      'Resource "userById" must declare a positive integer TTL in milliseconds.',
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
      'Resource "userById" must declare a positive integer version.',
    ],
    [
      'a fractional TTL',
      {
        ...validPolicy,
        resources: {
          userById: { ...validPolicy.resources.userById, ttl: 1.5 },
        },
      },
      'Resource "userById" must declare a positive integer TTL in milliseconds.',
    ],
    [
      'an unknown read resource',
      {
        ...validPolicy,
        methods: { findById: { cache: 'missing' } },
      },
      'Method "findById" references an unknown or invalid resource.',
    ],
    [
      'a rule with cache and effects',
      {
        ...validPolicy,
        methods: { findById: { cache: 'userById', effects: [] } },
      },
      'Method "findById" must declare either cache or effects.',
    ],
    [
      'an empty effects list',
      {
        ...validPolicy,
        methods: { update: { effects: [] } },
      },
      'Method "update" must declare at least one effect.',
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
      'Method "update" effects must declare invalidate or writeThrough.',
    ],
  ])(
    'rejects %s with its stable error message',
    (_scenario, policy, message) => {
      expect(() => validateCachePolicy(policy)).toThrow(
        new InvalidCachePolicyError(message),
      );
    },
  );

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
