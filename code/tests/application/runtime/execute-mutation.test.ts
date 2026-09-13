import { describe, expect, it, vi } from 'vitest';

import { CacheNamespace } from '../../../src/domain/key/cache-namespace.js';
import type { CacheKey } from '../../../src/domain/key/cache-key.js';
import { ValidatedCachePolicy } from '../../../src/domain/policy/validated-cache-policy.js';
import type { TimeToLive } from '../../../src/domain/policy/time-to-live.js';
import type { CacheEventReporter } from '../../../src/application/runtime/cache-event-reporter.port.js';
import type { CacheStore } from '../../../src/application/runtime/cache-store.port.js';
import { CachePolicyCompiler } from '../../../src/application/runtime/compile-cache-policy.js';
import { CacheProxyFactory } from '../../../src/application/runtime/create-cache-proxy.js';
import { CacheEffectsExecutor } from '../../../src/application/runtime/execute-cache-effects.js';
import { CacheAsideExecutor } from '../../../src/application/runtime/execute-cache-aside.js';
import { MutationExecutor } from '../../../src/application/runtime/execute-mutation.js';
import {
  CacheEventType,
  CacheOperationError,
} from '../../../src/application/runtime/cache-event.js';
import { NoopCacheEventReporter } from '../../../src/application/runtime/noop-cache-event-reporter.js';
import { CacheOperations } from '../../../src/application/runtime/cache-operations.js';

const namespace = CacheNamespace.from({
  application: 'users-api',
  environment: 'test',
});

interface User {
  readonly id: string;
  readonly name: string;
}

interface Provider {
  findById(id: string): Promise<User>;
  list(): Promise<readonly User[]>;
  update(id: string, name: string): Promise<User>;
}

function createCache(overrides: Partial<CacheStore> = {}): CacheStore {
  return {
    delete: () => Promise.resolve(),
    get: () => Promise.resolve(undefined),
    set: () => Promise.resolve(),
    ...overrides,
  };
}

function createPolicy() {
  return new CachePolicyCompiler().compile(
    ValidatedCachePolicy.create({
      resources: {
        userById: {
          key: ([id]: readonly unknown[]) => String(id),
          method: 'findById',
          ttl: 60_000,
          version: 1,
        },
        users: {
          key: () => 'all',
          method: 'list',
          ttl: 30_000,
          version: 1,
        },
      },
      methods: {
        findById: { cache: 'userById' },
        update: {
          effects: [
            {
              invalidate: {
                keyArgs: ({ args }: { readonly args: readonly unknown[] }) => [
                  args[0],
                ],
                resource: 'userById',
              },
            },
            { invalidate: { resource: 'users' } },
            {
              writeThrough: {
                keyArgs: ({ result }: { readonly result: User }) => [result.id],
                resource: 'userById',
                value: ({ result }: { readonly result: User }) => result,
              },
            },
          ],
        },
      },
    }),
  );
}

function createProxy(
  target: Provider,
  cache: CacheStore,
  reporter: CacheEventReporter = new NoopCacheEventReporter(),
): Provider {
  return new CacheProxyFactory(
    new CacheAsideExecutor(new CacheOperations(cache, reporter), namespace),
    new MutationExecutor(
      new CacheEffectsExecutor(new CacheOperations(cache, reporter), namespace),
    ),
  ).create(target, createPolicy());
}

describe('mutation cache effects', () => {
  it('compiles ordered mutation effects separately from read rules', () => {
    const policy = createPolicy();

    expect(policy.readRuleFor('update')).toBeUndefined();
    expect(policy.mutationRuleFor('update')?.effects).toMatchObject([
      { kind: 'invalidate', resource: 'userById' },
      { kind: 'invalidate', resource: 'users' },
      { kind: 'writeThrough', resource: 'userById' },
    ]);
  });

  it('runs exact effects in declaration order after the provider succeeds', async () => {
    const events: string[] = [];
    const updated = { id: 'user-1', name: 'Ada' };
    const cache = createCache({
      delete: vi.fn((key: CacheKey) => {
        events.push(`delete:${key.value}`);
        return Promise.resolve();
      }),
      set: vi.fn((key: CacheKey, value: unknown, ttl: TimeToLive) => {
        events.push(`set:${key.value}:${String(ttl.milliseconds)}`);
        expect(value).toEqual({
          marker: 'nestjs-cache-proxy',
          payload: updated,
          version: 1,
        });
        return Promise.resolve();
      }),
    });
    const update = vi.fn(() => {
      events.push('provider');
      return Promise.resolve(updated);
    });
    const proxy = createProxy(
      { findById: vi.fn(), list: vi.fn(), update },
      cache,
    );

    await expect(proxy.update('user-1', 'Ada')).resolves.toBe(updated);

    expect(events).toHaveLength(4);
    expect(events[0]).toBe('provider');
    expect(events[1]).toContain('delete:ncp:k1:');
    expect(events[2]).toContain('delete:ncp:k1:');
    expect(events[3]).toContain('set:ncp:k1:');
  });

  it('does not evaluate effects when the provider rejects', async () => {
    const failure = new Error('provider failed');
    const keyArgs = vi.fn(() => ['user-1']);
    const policy = new CachePolicyCompiler().compile(
      ValidatedCachePolicy.create({
        resources: {
          userById: {
            key: ([id]: readonly unknown[]) => String(id),
            method: 'findById',
            ttl: 1,
            version: 1,
          },
        },
        methods: {
          update: {
            effects: [{ invalidate: { keyArgs, resource: 'userById' } }],
          },
        },
      }),
    );
    const deleteCache = vi.fn<CacheStore['delete']>();
    const cache = createCache({ delete: deleteCache });
    const proxy = new CacheProxyFactory(
      new CacheAsideExecutor(
        new CacheOperations(cache, new NoopCacheEventReporter()),
        namespace,
      ),
      new MutationExecutor(
        new CacheEffectsExecutor(
          new CacheOperations(cache, new NoopCacheEventReporter()),
          namespace,
        ),
      ),
    ).create<Provider>(
      {
        findById: vi.fn(),
        list: vi.fn(),
        update: () => Promise.reject(failure),
      },
      policy,
    );

    await expect(proxy.update('user-1', 'Ada')).rejects.toBe(failure);

    expect(keyArgs).not.toHaveBeenCalled();
    expect(deleteCache).not.toHaveBeenCalled();
  });

  it('does not execute effects when the provider throws', async () => {
    const failure = new Error('provider failed');
    const deleteCache = vi.fn<CacheStore['delete']>();
    const setCache = vi.fn<CacheStore['set']>();
    const cache = createCache({ delete: deleteCache, set: setCache });
    const proxy = createProxy(
      {
        findById: vi.fn(),
        list: vi.fn(),
        update: () => {
          throw failure;
        },
      },
      cache,
    );

    await expect(proxy.update('user-1', 'Ada')).rejects.toBe(failure);

    expect(deleteCache).not.toHaveBeenCalled();
    expect(setCache).not.toHaveBeenCalled();
  });

  it('reports cache failures, continues later effects, and preserves the provider result', async () => {
    const failure = new Error('delete failed');
    const reporter = {
      report: vi.fn<CacheEventReporter['report']>(() =>
        Promise.reject(new Error('hook failed')),
      ),
    } satisfies CacheEventReporter;
    const deleteCache = vi
      .fn<CacheStore['delete']>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const setCache = vi
      .fn<CacheStore['set']>()
      .mockRejectedValueOnce(new Error('set failed'));
    const cache = createCache({
      delete: deleteCache,
      set: setCache,
    });
    const result = { id: 'user-1', name: 'Ada' };
    const proxy = createProxy(
      {
        findById: vi.fn(),
        list: vi.fn(),
        update: vi.fn(() => Promise.resolve(result)),
      },
      cache,
      reporter,
    );

    await expect(proxy.update('user-1', 'Ada')).resolves.toBe(result);

    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(setCache).toHaveBeenCalledOnce();
    expect(reporter.report).toHaveBeenCalledTimes(3);
    const event = reporter.report.mock.calls[0]![0];
    if (event.type !== CacheEventType.DELETE_ERROR) {
      throw new Error('Expected an error cache event.');
    }
    expect(event.cause).toBeInstanceOf(CacheOperationError);
    expect(event.operation).toBe('delete');
    expect(event.outcome).toBe('error');
    expect(event.resource).toBe('userById');
    expect(event.type).toBe(CacheEventType.DELETE_ERROR);
  });

  it('applies write-through admission to the target resource arguments and value', async () => {
    const cacheIf = vi.fn(
      ({
        args,
        result,
      }: {
        readonly args: readonly unknown[];
        readonly result: User;
      }) => args[0] === result.id && result.name !== 'missing',
    );
    const set = vi.fn<CacheStore['set']>();
    const policy = new CachePolicyCompiler().compile(
      ValidatedCachePolicy.create({
        resources: {
          userById: {
            cacheIf,
            key: ([id]: readonly unknown[]) => String(id),
            method: 'findById',
            ttl: 1,
            version: 1,
          },
        },
        methods: {
          update: {
            effects: [
              {
                writeThrough: {
                  keyArgs: ({ result }: { readonly result: User }) => [
                    result.id,
                  ],
                  resource: 'userById',
                  value: ({ result }: { readonly result: User }) => ({
                    ...result,
                    name: 'missing',
                  }),
                },
              },
            ],
          },
        },
      }),
    );
    const proxy = new CacheProxyFactory(
      new CacheAsideExecutor(
        new CacheOperations(createCache({ set }), new NoopCacheEventReporter()),
        namespace,
      ),
      new MutationExecutor(
        new CacheEffectsExecutor(
          new CacheOperations(
            createCache({ set }),
            new NoopCacheEventReporter(),
          ),
          namespace,
        ),
      ),
    ).create<Provider>(
      {
        findById: vi.fn(),
        list: vi.fn(),
        update: () => Promise.resolve({ id: 'user-1', name: 'Ada' }),
      },
      policy,
    );

    await proxy.update('user-1', 'Ada');

    expect(cacheIf).toHaveBeenCalledWith({
      args: ['user-1'],
      result: { id: 'user-1', name: 'missing' },
    });
    expect(set).not.toHaveBeenCalled();
  });

  it('permits a concurrent pre-mutation read to repopulate a stale entry', async () => {
    const events: string[] = [];
    let resolveRead: ((value: User) => void) | undefined;
    const pendingRead = new Promise<User>((resolve) => {
      resolveRead = resolve;
    });
    const cache = createCache({
      delete: vi.fn(() => {
        events.push('delete');
        return Promise.resolve();
      }),
      set: vi.fn(() => {
        events.push('set stale read');
        return Promise.resolve();
      }),
    });
    const proxy = createProxy(
      {
        findById: vi.fn(() => pendingRead),
        list: vi.fn(),
        update: vi.fn(() => Promise.resolve({ id: 'user-1', name: 'new' })),
      },
      cache,
    );

    const read = proxy.findById('user-1');
    await proxy.update('user-1', 'new');
    resolveRead?.({ id: 'user-1', name: 'stale' });
    await read;

    expect(events).toContain('delete');
    expect(events.at(-1)).toBe('set stale read');
  });
});
