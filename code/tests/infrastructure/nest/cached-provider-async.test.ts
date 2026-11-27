import 'reflect-metadata';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import {
  cachedProviderAsync,
  defineCachePolicy,
  InvalidCachePolicyError,
} from '../../../src/index.js';
import { CACHE_PROXY_OPTIONS } from '../../../src/infrastructure/nest/cache-proxy-options.js';
import {
  createTestCache,
  TestCacheOperationType,
} from '../../../src/testing/index.js';

interface UserReader {
  findById(id: string): Promise<string>;
}

const namespace = {
  application: 'users-api',
  environment: 'test',
} as const;

function createPolicy(ttl: number) {
  return defineCachePolicy<UserReader>()({
    resources: {
      userById: {
        method: 'findById',
        version: 1,
        ttl,
        key: ([id]) => id,
      },
    },
    methods: { findById: { cache: 'userById' } },
  });
}

function rootProviders(cache: ReturnType<typeof createTestCache>['cache']) {
  return [
    { provide: CACHE_MANAGER, useValue: cache },
    {
      provide: CACHE_PROXY_OPTIONS,
      useValue: { namespace },
    },
  ];
}

describe('cachedProviderAsync', () => {
  it('injects a dependency into useFactory and applies its generated policy', async () => {
    const testCache = createTestCache();
    const config = { cacheTtl: 1_000 };

    @Injectable()
    class Reader implements UserReader {
      public calls = 0;

      public findById(id: string): Promise<string> {
        this.calls += 1;
        return Promise.resolve(`source:${id}:${this.calls}`);
      }
    }

    const module = await Test.createTestingModule({
      providers: [
        ...rootProviders(testCache.cache),
        { provide: 'cache-config', useValue: config },
        ...cachedProviderAsync({
          provide: Reader,
          useClass: Reader,
          inject: ['cache-config'],
          useFactory: (injectedConfig: typeof config) =>
            createPolicy(injectedConfig.cacheTtl),
        }),
      ],
    }).compile();

    const reader = module.get(Reader);
    await expect(reader.findById('1')).resolves.toBe('source:1:1');
    await expect(reader.findById('1')).resolves.toBe('source:1:1');

    expect(reader.calls).toBe(1);
    expect(
      testCache
        .operations()
        .find((operation) => operation.type === TestCacheOperationType.SET),
    ).toMatchObject({ ttl: 1_000 });

    testCache.clock.advanceBy(1_000);
    await expect(reader.findById('1')).resolves.toBe('source:1:2');
    await module.close();
  });

  it('waits for an asynchronous policy factory during bootstrap', async () => {
    const testCache = createTestCache();
    const factory = vi.fn(async () => {
      await Promise.resolve();
      return createPolicy(60_000);
    });

    @Injectable()
    class Reader implements UserReader {
      public findById(id: string): Promise<string> {
        return Promise.resolve(`source:${id}`);
      }
    }

    const module = await Test.createTestingModule({
      providers: [
        ...rootProviders(testCache.cache),
        ...cachedProviderAsync({
          provide: Reader,
          useClass: Reader,
          useFactory: factory,
        }),
      ],
    }).compile();

    expect(factory).toHaveBeenCalledOnce();
    await expect(module.get(Reader).findById('1')).resolves.toBe('source:1');
    await module.close();
  });

  it('rejects an invalid generated policy during bootstrap', async () => {
    @Injectable()
    class Reader implements UserReader {
      public findById(id: string): Promise<string> {
        return Promise.resolve(id);
      }
    }

    const compilation = Test.createTestingModule({
      providers: [
        ...rootProviders(createTestCache().cache),
        ...cachedProviderAsync({
          provide: Reader,
          useClass: Reader,
          useFactory: () => ({}) as ReturnType<typeof createPolicy>,
        }),
      ],
    }).compile();

    await expect(compilation).rejects.toThrow(InvalidCachePolicyError);
    await expect(compilation).rejects.toThrow(
      'Policy resources must be an object.',
    );
  });

  it('keeps implementation and policy resolution isolated between registrations', async () => {
    const testCache = createTestCache();

    @Injectable()
    class FirstReader implements UserReader {
      public calls = 0;

      public findById(id: string): Promise<string> {
        this.calls += 1;
        return Promise.resolve(`first:${id}`);
      }
    }

    @Injectable()
    class SecondReader implements UserReader {
      public calls = 0;

      public findById(id: string): Promise<string> {
        this.calls += 1;
        return Promise.resolve(`second:${id}`);
      }
    }

    const firstPolicy = defineCachePolicy<UserReader>()({
      resources: {
        firstUserById: {
          method: 'findById',
          version: 1,
          ttl: 1_000,
          key: ([id]) => id,
        },
      },
      methods: { findById: { cache: 'firstUserById' } },
    });
    const secondPolicy = defineCachePolicy<UserReader>()({
      resources: {
        secondUserById: {
          method: 'findById',
          version: 1,
          ttl: 2_000,
          key: ([id]) => id,
        },
      },
      methods: { findById: { cache: 'secondUserById' } },
    });

    const module = await Test.createTestingModule({
      providers: [
        ...rootProviders(testCache.cache),
        ...cachedProviderAsync({
          provide: 'first-reader',
          useClass: FirstReader,
          useFactory: () => firstPolicy,
        }),
        ...cachedProviderAsync({
          provide: 'second-reader',
          useClass: SecondReader,
          useFactory: () => Promise.resolve(secondPolicy),
        }),
      ],
    }).compile();

    const first = module.get<UserReader>('first-reader');
    const second = module.get<UserReader>('second-reader');
    await expect(first.findById('1')).resolves.toBe('first:1');
    await expect(second.findById('1')).resolves.toBe('second:1');
    await expect(first.findById('1')).resolves.toBe('first:1');
    await expect(second.findById('1')).resolves.toBe('second:1');

    expect((first as FirstReader).calls).toBe(1);
    expect((second as SecondReader).calls).toBe(1);
    expect(
      testCache
        .operations()
        .filter((operation) => operation.type === TestCacheOperationType.SET)
        .map((operation) => operation.ttl),
    ).toEqual([1_000, 2_000]);
    await module.close();
  });
});
