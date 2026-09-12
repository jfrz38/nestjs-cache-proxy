import { describe, expect, it, vi } from 'vitest';

import { CacheNamespace } from '../../../src/domain/key/cache-namespace.js';
import type { CacheKey } from '../../../src/domain/key/cache-key.js';
import { ValidatedCachePolicy } from '../../../src/domain/policy/validated-cache-policy.js';
import type { TimeToLive } from '../../../src/domain/policy/time-to-live.js';
import type { CacheErrorReporter } from '../../../src/application/runtime/cache-error-reporter.port.js';
import type { CacheStore } from '../../../src/application/runtime/cache-store.port.js';
import { CachePolicyCompiler } from '../../../src/application/runtime/compile-cache-policy.js';
import { CacheProxyFactory } from '../../../src/application/runtime/create-cache-proxy.js';
import { CacheEffectsExecutor } from '../../../src/application/runtime/execute-cache-effects.js';
import { CacheAsideExecutor } from '../../../src/application/runtime/execute-cache-aside.js';
import { MutationExecutor } from '../../../src/application/runtime/execute-mutation.js';
import { NoopCacheErrorReporter } from '../../../src/application/runtime/noop-cache-error-reporter.js';

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
  reporter: CacheErrorReporter = new NoopCacheErrorReporter(),
): Provider {
  return new CacheProxyFactory(
    new CacheAsideExecutor(cache, namespace),
    new MutationExecutor(new CacheEffectsExecutor(cache, namespace, reporter)),
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
        expect(value).toBe(updated);
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
      new CacheAsideExecutor(cache, namespace),
      new MutationExecutor(
        new CacheEffectsExecutor(
          cache,
          namespace,
          new NoopCacheErrorReporter(),
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
      report: vi.fn(() => Promise.reject(new Error('hook failed'))),
    };
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
    expect(reporter.report).toHaveBeenCalledTimes(2);
    expect(reporter.report).toHaveBeenNthCalledWith(1, {
      cause: failure,
      operation: 'delete',
      resource: 'userById',
    });
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
