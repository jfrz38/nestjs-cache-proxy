import 'reflect-metadata';

import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Cache } from 'cache-manager';
import { describe, expect, it, vi } from 'vitest';

import {
  CacheProxyModule,
  defineCachePolicy,
  InvalidCachedProviderError,
} from '../../../src/index.js';

interface UserReader {
  findById(id: string): Promise<string>;
}

const policy = defineCachePolicy<UserReader>()({
  resources: {
    userById: {
      method: 'findById',
      version: 1,
      ttl: 60_000,
      key: ([id]) => id,
    },
  },
  methods: { findById: { cache: 'userById' } },
});

const readerToken = Symbol('reader');

@Injectable()
class ClassReader implements UserReader {
  public calls = 0;

  public findById(id: string): Promise<string> {
    this.calls += 1;
    return Promise.resolve(`class:${id}`);
  }
}

@Injectable()
class StringReader implements UserReader {
  public findById(id: string): Promise<string> {
    return Promise.resolve(`string:${id}`);
  }
}

@Injectable()
class SymbolReader implements UserReader {
  public findById(id: string): Promise<string> {
    return Promise.resolve(`symbol:${id}`);
  }
}

@Injectable()
class Consumer {
  public constructor(
    public readonly classReader: ClassReader,
    @Inject('string-reader') public readonly stringReader: UserReader,
    @Inject(readerToken) public readonly symbolReader: UserReader,
  ) {}
}

function createCache(): Cache {
  const values = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(values.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      values.set(key, value);
      return Promise.resolve();
    }),
  } as unknown as Cache;
}

describe('CacheProxyModule', () => {
  it('composes application-owned cache infrastructure with exported feature tokens', async () => {
    const cache = createCache();

    @Module({
      imports: [
        CacheModule.register({ isGlobal: true }),
        CacheProxyModule.forRoot({
          namespace: { application: 'users-api', environment: 'test' },
        }),
      ],
    })
    class ApplicationCacheModule {}

    @Module({
      imports: [
        CacheProxyModule.forFeature([
          { provide: ClassReader, useClass: ClassReader, policy },
          { provide: 'string-reader', useClass: StringReader, policy },
          { provide: readerToken, useClass: SymbolReader, policy },
        ]),
      ],
      exports: [CacheProxyModule],
    })
    class UserFeatureModule {}

    @Module({ imports: [UserFeatureModule], providers: [Consumer] })
    class ConsumerModule {}

    const module = await Test.createTestingModule({
      imports: [ApplicationCacheModule, ConsumerModule],
    })
      .overrideProvider(CACHE_MANAGER)
      .useValue(cache)
      .compile();

    const consumer = module.get(Consumer);
    await expect(consumer.classReader.findById('1')).resolves.toBe('class:1');
    await expect(consumer.classReader.findById('1')).resolves.toBe('class:1');
    await expect(consumer.stringReader.findById('2')).resolves.toBe('string:2');
    await expect(consumer.symbolReader.findById('3')).resolves.toBe('symbol:3');

    expect(consumer.classReader.calls).toBe(1);
    expect(cache.get).toHaveBeenCalledTimes(4);
    expect(module.get(CACHE_MANAGER)).toBe(cache);
    await module.close();
  });

  it('rejects invalid root options before NestJS bootstraps', () => {
    expect(() =>
      CacheProxyModule.forRoot({
        namespace: { application: '', environment: 'test' },
      }),
    ).toThrow('non-empty string');
  });

  it('rejects duplicate public tokens in one feature registration', () => {
    expect(() =>
      CacheProxyModule.forFeature([
        { provide: 'reader', useClass: StringReader, policy },
        { provide: 'reader', useClass: StringReader, policy },
      ]),
    ).toThrow(InvalidCachedProviderError);
  });

  it('reports an application cache manager missing at bootstrap', async () => {
    const module = Test.createTestingModule({
      imports: [
        CacheProxyModule.forRoot({
          namespace: { application: 'users-api', environment: 'test' },
        }),
        CacheProxyModule.forFeature([
          { provide: 'reader', useClass: StringReader, policy },
        ]),
      ],
    }).compile();

    await expect(module).rejects.toThrow('CACHE_MANAGER');
  });

  it('exports only configured feature tokens', () => {
    const feature = CacheProxyModule.forFeature([
      { provide: 'reader', useClass: StringReader, policy },
    ]);

    expect(feature.exports).toEqual(['reader']);
  });
});
