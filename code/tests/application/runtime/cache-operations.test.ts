import { describe, expect, it, vi } from 'vitest';

import { CacheKey } from '../../../src/domain/key/cache-key.js';
import { CacheKeyVersion } from '../../../src/domain/key/cache-key-version.js';
import { CacheNamespace } from '../../../src/domain/key/cache-namespace.js';
import { CacheResourceName } from '../../../src/domain/key/cache-resource-name.js';
import { TimeToLive } from '../../../src/domain/policy/time-to-live.js';
import { CacheOperations } from '../../../src/application/runtime/cache-operations.js';
import { CacheOperationError } from '../../../src/application/runtime/cache-error-event.js';
import {
  CacheEnvelope,
  CacheEnvelopeState,
} from '../../../src/application/runtime/cache-envelope.js';
import type { CacheErrorReporter } from '../../../src/application/runtime/cache-error-reporter.port.js';
import type { CacheStore } from '../../../src/application/runtime/cache-store.port.js';

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

function createCache(overrides: Partial<CacheStore> = {}): CacheStore {
  return {
    delete: () => Promise.resolve(),
    get: () => Promise.resolve(undefined),
    set: () => Promise.resolve(),
    ...overrides,
  };
}

describe('CacheEnvelope', () => {
  it.each([null, false, 0, '', { id: 'user-1' }, ['user-1']])(
    'round-trips supported payloads',
    (value) => {
      expect(CacheEnvelope.decode(CacheEnvelope.encode(value))).toEqual({
        state: CacheEnvelopeState.HIT,
        value,
      });
    },
  );

  it('does not encode undefined', () => {
    expect(CacheEnvelope.encode(undefined)).toBeUndefined();
  });

  it.each([
    { marker: 'other-library', payload: 'value', version: 1 },
    { marker: 'nestjs-cache-proxy', payload: 'value', version: 2 },
    { marker: 'nestjs-cache-proxy', version: 1 },
    'raw value',
  ])('rejects malformed envelopes', (value) => {
    expect(CacheEnvelope.decode(value)).toEqual({
      state: CacheEnvelopeState.MALFORMED,
    });
  });
});

describe('CacheOperations', () => {
  it('treats a malformed cached value as a reported miss without exposing its payload', async () => {
    const reporter = {
      report: vi.fn<CacheErrorReporter['report']>(),
    } satisfies CacheErrorReporter;
    const operations = new CacheOperations(
      createCache({
        get: () =>
          Promise.resolve({
            marker: 'nestjs-cache-proxy',
            payload: 'sensitive cache value',
            version: 2,
          }),
      }),
      reporter,
    );

    await expect(operations.get('userById', key)).resolves.toBeUndefined();

    const event = reporter.report.mock.calls[0]![0];
    expect(event.cause).toBeInstanceOf(CacheOperationError);
    expect(event.operation).toBe('get');
    expect(event.resource).toBe('userById');
  });

  it('sanitizes backend failures and isolates reporter failures', async () => {
    const reporter = {
      report: vi.fn<CacheErrorReporter['report']>(() =>
        Promise.reject(new Error('hook failure')),
      ),
    } satisfies CacheErrorReporter;
    const operations = new CacheOperations(
      createCache({
        get: () => Promise.reject(new Error(`backend failed for ${key.value}`)),
      }),
      reporter,
    );

    await expect(operations.get('userById', key)).resolves.toBeUndefined();

    const event = reporter.report.mock.calls[0]![0];
    expect(event.cause.message).toBe('A cache operation failed.');
    expect(event.cause.message).not.toContain(key.value);
    expect(event.cause.name).toBe('CacheOperationError');
  });

  it('skips undefined writes and reports failed set and delete operations', async () => {
    const reporter = {
      report: vi.fn<CacheErrorReporter['report']>(),
    } satisfies CacheErrorReporter;
    const set = vi
      .fn<CacheStore['set']>()
      .mockRejectedValue(new Error('set failed'));
    const deleteOperation = vi
      .fn<CacheStore['delete']>()
      .mockRejectedValue(new Error('delete failed'));
    const operations = new CacheOperations(
      createCache({ delete: deleteOperation, set }),
      reporter,
    );

    await operations.set('userById', key, undefined, ttl);
    await operations.set('userById', key, null, ttl);
    await operations.delete('userById', key);

    expect(set).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(
      key,
      { marker: 'nestjs-cache-proxy', payload: null, version: 1 },
      ttl,
    );
    expect(deleteOperation).toHaveBeenCalledOnce();
    expect(reporter.report).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ operation: 'set', resource: 'userById' }),
    );
    expect(reporter.report).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ operation: 'delete', resource: 'userById' }),
    );
  });
});
