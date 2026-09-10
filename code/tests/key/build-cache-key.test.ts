import { describe, expect, it } from 'vitest';

import {
  buildCacheKey,
  CacheKeyValidationError,
  InvalidCacheKeyInputError,
  InvalidCacheKeyNamespaceError,
  InvalidCacheKeyResourceError,
  InvalidCacheKeyVersionError,
} from '../../src/index.js';

const keyInput = {
  namespace: { application: 'users-api', environment: 'production' },
  resource: 'userById',
  version: 1,
} as const;

describe('buildCacheKey', () => {
  it('builds the frozen k1 format for nested structured input', () => {
    expect(
      buildCacheKey({
        ...keyInput,
        input: { tenantId: 'tenant-1', filters: [true, null, 2] },
      }),
    ).toBe(
      'ncp:k1:{"input":{"t":"object","v":[["filters",{"t":"array","v":[{"t":"boolean","v":true},{"t":"null"},{"t":"number","v":"2"}]}],["tenantId",{"t":"string","v":"tenant-1"}]]},"namespace":{"application":"users-api","environment":"production"},"resource":"userById","version":1}',
    );
  });

  it('orders equivalent object inputs by UTF-16 property order', () => {
    const left = buildCacheKey({
      ...keyInput,
      input: { nested: { z: 1, a: 2 }, z: true, a: false },
    });
    const right = buildCacheKey({
      ...keyInput,
      input: { a: false, z: true, nested: { a: 2, z: 1 } },
    });

    expect(left).toBe(right);
  });

  it.each([
    ['number and string', 1, '1'],
    ['null and string', null, 'null'],
    ['array and object', ['value'], { 0: 'value' }],
    ['negative zero and zero', -0, 0],
    ['values containing delimiters', 'a:b', ['a', 'b']],
  ])('keeps %s distinct', (_scenario, left, right) => {
    expect(buildCacheKey({ ...keyInput, input: left })).not.toBe(
      buildCacheKey({ ...keyInput, input: right }),
    );
  });

  it('isolates namespace, resource, and version changes', () => {
    const base = buildCacheKey({ ...keyInput, input: 'user-1' });

    expect(
      buildCacheKey({
        ...keyInput,
        namespace: { application: 'users-api', environment: 'staging' },
        input: 'user-1',
      }),
    ).not.toBe(base);
    expect(
      buildCacheKey({ ...keyInput, resource: 'userByEmail', input: 'user-1' }),
    ).not.toBe(base);
    expect(
      buildCacheKey({ ...keyInput, version: 2, input: 'user-1' }),
    ).not.toBe(base);
  });

  it('allows shared references that are not cycles', () => {
    const shared = { tenantId: 'tenant-1' };

    expect(() =>
      buildCacheKey({ ...keyInput, input: { first: shared, second: shared } }),
    ).not.toThrow();
  });

  it.each([
    ['undefined', undefined],
    ['a function', () => undefined],
    ['a symbol', Symbol('key')],
    ['a bigint', 1n],
    ['an infinite number', Infinity],
    ['a Date', new Date()],
    ['a Map', new Map()],
    ['a Set', new Set()],
    ['a class instance', new (class Value {})()],
  ])('rejects %s', (_scenario, input) => {
    expect(() => buildCacheKey({ ...keyInput, input } as never)).toThrow(
      InvalidCacheKeyInputError,
    );
  });

  it('rejects sparse arrays, accessors, symbols, and cycles without exposing values', () => {
    const sparse = ['user'] as string[];
    sparse.length = 2;
    const accessor = {};
    Object.defineProperty(accessor, 'secret', {
      enumerable: true,
      get: () => 'do-not-disclose',
    });
    const symbolProperty = { tenantId: 'tenant-1' };
    Object.defineProperty(symbolProperty, Symbol('secret'), {
      value: 'secret',
    });
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    for (const input of [sparse, accessor, symbolProperty, cyclic]) {
      expect(() => buildCacheKey({ ...keyInput, input })).toThrow(
        InvalidCacheKeyInputError,
      );
    }

    try {
      buildCacheKey({ ...keyInput, input: accessor });
    } catch (error) {
      expect(String(error)).not.toContain('do-not-disclose');
      expect(String(error)).not.toContain('secret');
    }
  });

  it('escapes string and property delimiters in the frozen format', () => {
    expect(
      buildCacheKey({ ...keyInput, input: { 'a"b': 'line\nbreak' } }),
    ).toContain('[["a\\"b",{"t":"string","v":"line\\nbreak"}]]');
  });

  it.each([
    ['an empty application', { application: '', environment: 'production' }],
    ['an empty environment', { application: 'users-api', environment: ' ' }],
  ])('rejects %s', (_scenario, namespace) => {
    expect(() =>
      buildCacheKey({ ...keyInput, namespace, input: 'user-1' }),
    ).toThrow(InvalidCacheKeyNamespaceError);
  });

  it('rejects an empty resource with its specific error', () => {
    expect(() =>
      buildCacheKey({ ...keyInput, resource: ' ', input: 'user-1' }),
    ).toThrow(InvalidCacheKeyResourceError);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid version %s',
    (version) => {
      expect(() =>
        buildCacheKey({ ...keyInput, version, input: 'user-1' }),
      ).toThrow(InvalidCacheKeyVersionError);
    },
  );

  it('exposes stable specialized errors that extend the common validation error', () => {
    const errors = [
      [
        new InvalidCacheKeyNamespaceError('namespace'),
        'InvalidCacheKeyNamespaceError',
        'INVALID_NAMESPACE',
      ],
      [
        new InvalidCacheKeyResourceError('resource'),
        'InvalidCacheKeyResourceError',
        'INVALID_RESOURCE',
      ],
      [
        new InvalidCacheKeyVersionError('version'),
        'InvalidCacheKeyVersionError',
        'INVALID_VERSION',
      ],
      [
        new InvalidCacheKeyInputError('input'),
        'InvalidCacheKeyInputError',
        'INVALID_INPUT',
      ],
    ] as const;

    for (const [error, name, code] of errors) {
      expect(error).toBeInstanceOf(CacheKeyValidationError);
      expect(error).toMatchObject({ code, name });
    }
  });
});
