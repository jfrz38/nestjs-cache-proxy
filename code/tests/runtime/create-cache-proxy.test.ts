import { describe, expect, it, vi } from 'vitest';

import { CacheNamespace } from '../../src/key/cache-namespace.js';
import type { CacheStore } from '../../src/runtime/cache-store.port.js';
import { CachePolicyCompiler } from '../../src/runtime/compile-cache-policy.js';
import { CacheProxyFactory } from '../../src/runtime/create-cache-proxy.js';
import { CacheAsideExecutor } from '../../src/runtime/execute-cache-aside.js';

const namespace = { application: 'users-api', environment: 'test' };

interface ReadProvider {
  findById(id: string): Promise<unknown>;
}

function createCache(
  get: CacheStore['get'] = () => Promise.resolve(undefined),
  set: CacheStore['set'] = () => Promise.resolve(undefined),
): CacheStore {
  return { get, set };
}

function createProxy<T extends object>(
  target: T,
  cache: CacheStore,
  policy = createPolicy(),
): T {
  return new CacheProxyFactory(
    new CacheAsideExecutor(cache, CacheNamespace.from(namespace)),
  ).create(target, policy);
}

function createPolicy() {
  return new CachePolicyCompiler().compile({
    resources: {
      userById: {
        method: 'findById',
        version: 1,
        ttl: 60_000,
        key: ([id]: readonly unknown[]) => ({ id: String(id) }),
      },
    },
    methods: {
      findById: { cache: 'userById' },
      update: {
        effects: [
          { invalidate: { resource: 'userById', keyArgs: () => ['id'] } },
        ],
      },
    },
  });
}

describe('createCacheProxy', () => {
  it('compiles only read rules into immutable value-object-backed rules', () => {
    const policy = createPolicy();
    const rule = policy.readRuleFor('findById');

    expect(rule).toMatchObject({
      resource: { value: 'userById' },
      ttl: { milliseconds: 60_000 },
      version: { value: 1 },
    });
    expect(policy.readRuleFor('update')).toBeUndefined();
  });

  it('returns a cached hit without invoking the provider', async () => {
    const cache = createCache(() => Promise.resolve({ id: 'cached' }));
    const findById = vi.fn(() => Promise.resolve({ id: 'provider' }));
    const proxy = createProxy<ReadProvider>({ findById }, cache);

    await expect(proxy.findById('user-1')).resolves.toEqual({ id: 'cached' });

    expect(findById).not.toHaveBeenCalled();
  });

  it('reads, invokes, writes, and then hits the cache', async () => {
    const values = new Map<string, unknown>();
    const events: string[] = [];
    const cache = createCache(
      (key) => {
        events.push('get');
        return Promise.resolve(values.get(key.value));
      },
      (key, value) => {
        events.push('set');
        values.set(key.value, value);
        return Promise.resolve();
      },
    );
    const findById = vi.fn(() => {
      events.push('provider');
      return Promise.resolve({ id: 'user-1' });
    });
    const proxy = createProxy<ReadProvider>({ findById }, cache);

    await expect(proxy.findById('user-1')).resolves.toEqual({ id: 'user-1' });
    await expect(proxy.findById('user-1')).resolves.toEqual({ id: 'user-1' });

    expect(events).toEqual(['get', 'provider', 'set', 'get']);
    expect(findById).toHaveBeenCalledTimes(1);
  });

  it('treats cache failures as misses without replacing a provider result', async () => {
    const get = vi.fn(() => Promise.reject(new Error('cache get failed')));
    const set = vi.fn(() => Promise.reject(new Error('cache set failed')));
    const findById = vi.fn(() => Promise.resolve({ id: 'user-1' }));
    const proxy = createProxy<ReadProvider>(
      { findById },
      createCache(get, set),
    );

    await expect(proxy.findById('user-1')).resolves.toEqual({ id: 'user-1' });

    expect(get).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(findById).toHaveBeenCalledTimes(1);
  });

  it('propagates provider failures and never writes them', async () => {
    const failure = new Error('provider failed');
    const set = vi.fn(() => Promise.resolve());
    const findById = vi.fn(() => Promise.reject(failure));
    const proxy = createProxy<ReadProvider>(
      { findById },
      createCache(undefined, set),
    );

    await expect(proxy.findById('user-1')).rejects.toBe(failure);

    expect(set).not.toHaveBeenCalled();
  });

  it('propagates synchronous provider failures and never writes them', async () => {
    const failure = new Error('provider failed synchronously');
    const set = vi.fn(() => Promise.resolve());
    const findById: ReadProvider['findById'] = () => {
      throw failure;
    };
    const proxy = createProxy<ReadProvider>(
      { findById },
      createCache(undefined, set),
    );

    await expect(proxy.findById('user-1')).rejects.toBe(failure);

    expect(set).not.toHaveBeenCalled();
  });

  it.each([undefined, null])(
    'does not cache %s provider results',
    async (result) => {
      const set = vi.fn(() => Promise.resolve());
      const findById = vi.fn(() => Promise.resolve(result));
      const proxy = createProxy<ReadProvider>(
        { findById },
        createCache(undefined, set),
      );

      await expect(proxy.findById('user-1')).resolves.toBe(result);

      expect(set).not.toHaveBeenCalled();
    },
  );

  it.each([false, 0, ''])('returns and caches falsy values', async (result) => {
    const set = vi.fn<CacheStore['set']>(() => Promise.resolve());
    const findById = vi.fn(() => Promise.resolve(result));
    const proxy = createProxy<ReadProvider>(
      { findById },
      createCache(undefined, set),
    );

    await expect(proxy.findById('user-1')).resolves.toBe(result);

    expect(set).toHaveBeenCalledOnce();
    const [key, cachedValue, ttl] = set.mock.calls[0]!;
    expect(key.value).toEqual(expect.any(String));
    expect(cachedValue).toBe(result);
    expect(ttl.milliseconds).toBe(60_000);
  });

  it('builds and validates the key before accessing the cache or provider', async () => {
    const get = vi.fn(() => Promise.resolve(undefined));
    const findById = vi.fn(() => Promise.resolve({ id: 'user-1' }));
    const policy = new CachePolicyCompiler().compile({
      resources: {
        invalid: {
          method: 'findById',
          version: 1,
          ttl: 1,
          key: () => undefined,
        },
      },
      methods: { findById: { cache: 'invalid' } },
    });
    const proxy = createProxy<ReadProvider>(
      { findById },
      createCache(get),
      policy,
    );

    await expect(proxy.findById('user-1')).rejects.toMatchObject({
      name: 'InvalidCacheKeyInputError',
    });

    expect(get).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
  });

  it('preserves private fields, accessors, symbols, and stable method wrappers', async () => {
    const marker = Symbol('marker');

    class Provider {
      #prefix = 'user';
      private value = 'initial';
      public readonly [marker] = 'symbol value';

      public get current(): string {
        return `${this.#prefix}:${this.value}`;
      }

      public set current(value: string) {
        this.value = value;
      }

      public findById(id: string): Promise<string> {
        return Promise.resolve(`${this.#prefix}:${id}`);
      }

      public synchronousMethod(): string {
        return this.current;
      }

      public update(): Promise<string> {
        return Promise.resolve(this.current);
      }
    }

    const proxy = createProxy(new Provider(), createCache());

    const firstMethod: unknown = Reflect.get(proxy, 'findById');
    const secondMethod: unknown = Reflect.get(proxy, 'findById');
    expect(firstMethod).toBe(secondMethod);
    await expect(proxy.findById('1')).resolves.toBe('user:1');
    expect(proxy[marker]).toBe('symbol value');
    expect(proxy.synchronousMethod()).toBe('user:initial');
    proxy.current = 'changed';
    await expect(proxy.update()).resolves.toBe('user:changed');
  });

  it('does not coalesce concurrent misses', async () => {
    let resolveProvider: ((value: string) => void) | undefined;
    const providerResult = new Promise<string>((resolve) => {
      resolveProvider = resolve;
    });
    const findById = vi.fn(() => providerResult);
    const proxy = createProxy<ReadProvider>({ findById }, createCache());

    const first = proxy.findById('user-1');
    const second = proxy.findById('user-1');
    resolveProvider?.('user-1');

    await expect(Promise.all([first, second])).resolves.toEqual([
      'user-1',
      'user-1',
    ]);
    expect(findById).toHaveBeenCalledTimes(2);
  });
});
