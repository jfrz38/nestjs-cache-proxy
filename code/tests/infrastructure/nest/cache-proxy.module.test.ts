import 'reflect-metadata';

import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import type { CacheErrorHook } from '../../../src/index.js';
import {
  CacheProxyModule,
  cachedProvider,
  defineCachePolicy,
  InvalidCachedProviderError,
} from '../../../src/index.js';
import {
  createTestCache,
  TestCacheOperationType,
} from '../../../src/testing/index.js';

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

describe('CacheProxyModule', () => {
  it('composes application-owned cache infrastructure with exported feature tokens', async () => {
    const testCache = createTestCache();

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
      .useValue(testCache.cache)
      .compile();

    const consumer = module.get(Consumer);
    await expect(consumer.classReader.findById('1')).resolves.toBe('class:1');
    await expect(consumer.classReader.findById('1')).resolves.toBe('class:1');
    await expect(consumer.stringReader.findById('2')).resolves.toBe('string:2');
    await expect(consumer.symbolReader.findById('3')).resolves.toBe('symbol:3');

    expect(consumer.classReader.calls).toBe(1);
    expect(
      testCache
        .operations()
        .filter((operation) => operation.type === TestCacheOperationType.GET),
    ).toHaveLength(4);
    expect(module.get(CACHE_MANAGER)).toBe(testCache.cache);
    await module.close();
  });

  it('resolves imported dependencies from a dedicated cache module', async () => {
    const testCache = createTestCache();
    const dependencyToken = Symbol('reader-dependency');
    const dedicatedReaderToken = Symbol('dedicated-reader');
    let calls = 0;

    @Injectable()
    class ReaderWithImportedDependency implements UserReader {
      public constructor(
        @Inject(dependencyToken) private readonly prefix: string,
      ) {}

      public findById(id: string): Promise<string> {
        calls += 1;
        return Promise.resolve(`${this.prefix}:${id}`);
      }
    }

    @Injectable()
    class DedicatedReaderConsumer {
      public constructor(
        @Inject(dedicatedReaderToken) public readonly reader: UserReader,
      ) {}
    }

    @Module({
      providers: [{ provide: dependencyToken, useValue: 'imported' }],
      exports: [dependencyToken],
    })
    class ReaderDependenciesModule {}

    @Module({
      imports: [ReaderDependenciesModule],
      providers: [
        ...cachedProvider({
          provide: dedicatedReaderToken,
          useClass: ReaderWithImportedDependency,
          policy,
        }),
      ],
      exports: [dedicatedReaderToken],
    })
    class UserCacheModule {}

    @Module({
      imports: [UserCacheModule],
      providers: [DedicatedReaderConsumer],
    })
    class ConsumerModule {}

    @Module({
      imports: [
        CacheModule.register({ isGlobal: true }),
        CacheProxyModule.forRoot({
          namespace: { application: 'users-api', environment: 'test' },
        }),
        ConsumerModule,
      ],
    })
    class ApplicationModule {}

    const module = await Test.createTestingModule({
      imports: [ApplicationModule],
    })
      .overrideProvider(CACHE_MANAGER)
      .useValue(testCache.cache)
      .compile();

    const consumer = module.get(DedicatedReaderConsumer);
    await expect(consumer.reader.findById('1')).resolves.toBe('imported:1');
    await expect(consumer.reader.findById('1')).resolves.toBe('imported:1');
    expect(calls).toBe(1);

    await module.close();
  });

  it('rejects invalid root options before NestJS bootstraps', () => {
    expect(() =>
      CacheProxyModule.forRoot({
        namespace: { application: '', environment: 'test' },
      }),
    ).toThrow('non-empty string');
  });

  it('reports sanitized cache failures through the root hook', async () => {
    const onCacheError = vi.fn<CacheErrorHook>();
    const cache = {
      get: vi.fn(() => Promise.reject(new Error('failed for raw-key:user-1'))),
      set: vi.fn(() => Promise.resolve()),
    } as unknown as Cache;

    @Module({
      imports: [
        CacheModule.register({ isGlobal: true }),
        CacheProxyModule.forRoot({
          namespace: { application: 'users-api', environment: 'test' },
          onCacheError,
        }),
        CacheProxyModule.forFeature([
          { provide: ClassReader, useClass: ClassReader, policy },
        ]),
      ],
    })
    class ApplicationModule {}

    const module = await Test.createTestingModule({
      imports: [ApplicationModule],
    })
      .overrideProvider(CACHE_MANAGER)
      .useValue(cache)
      .compile();

    await expect(module.get(ClassReader).findById('1')).resolves.toBe(
      'class:1',
    );

    const event = onCacheError.mock.calls[0]![0];
    expect(event.cause.message).toBe('A cache operation failed.');
    expect(event.cause.name).toBe('CacheOperationError');
    expect(event.cause.message).not.toContain('raw-key:user-1');
    expect(event.operation).toBe('get');
    expect(event.resource).toBe('userById');
    await module.close();
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
