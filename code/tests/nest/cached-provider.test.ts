import 'reflect-metadata';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Scope } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Cache } from 'cache-manager';
import { describe, expect, it, vi } from 'vitest';

import {
  cachedProvider,
  defineCachePolicy,
  InvalidCachedProviderError,
  InvalidCachePolicyError,
} from '../../src/index.js';
import { CACHE_PROXY_OPTIONS } from '../../src/nest/cache-proxy-options.js';

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

function rootProviders(cache = createCache()) {
  return [
    { provide: CACHE_MANAGER, useValue: cache },
    {
      provide: CACHE_PROXY_OPTIONS,
      useValue: {
        namespace: { application: 'users-api', environment: 'test' },
      },
    },
  ];
}

describe('cachedProvider', () => {
  it('provides cached behavior to a class token without cache-aware consumers', async () => {
    @Injectable()
    class Source {
      public calls = 0;

      public findById(id: string): Promise<string> {
        this.calls += 1;
        return Promise.resolve(`source:${id}`);
      }
    }

    @Injectable()
    class Consumer {
      public constructor(public readonly reader: Source) {}
    }

    const module = await Test.createTestingModule({
      providers: [
        ...rootProviders(),
        ...cachedProvider({ provide: Source, useClass: Source, policy }),
        Consumer,
      ],
    }).compile();

    const consumer = module.get(Consumer);
    await expect(consumer.reader.findById('1')).resolves.toBe('source:1');
    await expect(consumer.reader.findById('1')).resolves.toBe('source:1');

    expect(consumer.reader).toBe(module.get(Source));
    expect((consumer.reader as unknown as { calls: number }).calls).toBe(1);
    await module.close();
  });

  it.each([
    ['abstract class', AbstractReader],
    ['string', 'user-reader'],
    ['symbol', Symbol('user-reader')],
  ] as const)('supports a %s public token', async (_description, token) => {
    const module = await Test.createTestingModule({
      providers: [
        ...rootProviders(),
        ...cachedProvider({ provide: token, useClass: DefaultReader, policy }),
      ],
    }).compile();

    const reader = module.get<UserReader>(token);
    await expect(reader.findById('1')).resolves.toBe('source:1');

    await module.close();
  });

  it('resolves constructor dependencies once through NestJS', async () => {
    const dependency = { prefix: 'dependency' };

    @Injectable()
    class ReaderWithDependency {
      public constructor(
        @Inject('dependency') private readonly value: { prefix: string },
      ) {}

      public findById(id: string): Promise<string> {
        return Promise.resolve(`${this.value.prefix}:${id}`);
      }
    }

    const module = await Test.createTestingModule({
      providers: [
        ...rootProviders(),
        { provide: 'dependency', useValue: dependency },
        ...cachedProvider({
          provide: 'reader-with-dependency',
          useClass: ReaderWithDependency,
          policy,
        }),
      ],
    }).compile();

    await expect(
      module.get<UserReader>('reader-with-dependency').findById('1'),
    ).resolves.toBe('dependency:1');

    await module.close();
  });

  it('runs implementation lifecycle hooks once and hides them from the public proxy', async () => {
    const lifecycle = { init: 0, destroy: 0 };

    @Injectable()
    class LifecycleReader {
      public findById(id: string): Promise<string> {
        return Promise.resolve(id);
      }

      public onModuleInit(): void {
        lifecycle.init += 1;
      }

      public onModuleDestroy(): void {
        lifecycle.destroy += 1;
      }
    }

    const module = await Test.createTestingModule({
      providers: [
        ...rootProviders(),
        ...cachedProvider({
          provide: LifecycleReader,
          useClass: LifecycleReader,
          policy,
        }),
      ],
    }).compile();

    await module.init();

    expect(lifecycle.init).toBe(1);
    expect(
      Reflect.get(module.get(LifecycleReader), 'onModuleInit'),
    ).toBeUndefined();

    await module.close();
    expect(lifecycle.destroy).toBe(1);
  });

  it.each([Scope.REQUEST, Scope.TRANSIENT])(
    'rejects a non-singleton implementation scope',
    (scope) => {
      @Injectable({ scope })
      class ScopedReader {
        public findById(id: string): Promise<string> {
          return Promise.resolve(id);
        }
      }

      expect(() =>
        cachedProvider({
          provide: ScopedReader,
          useClass: ScopedReader,
          policy,
        }),
      ).toThrow(InvalidCachedProviderError);
    },
  );

  it('rejects malformed policies before NestJS bootstraps', () => {
    expect(() =>
      cachedProvider({
        provide: DefaultReader,
        useClass: DefaultReader,
        policy: {} as typeof policy,
      }),
    ).toThrow(InvalidCachePolicyError);
  });

  it('reports missing root collaborators during NestJS bootstrap', async () => {
    const module = Test.createTestingModule({
      providers: [
        ...cachedProvider({
          provide: DefaultReader,
          useClass: DefaultReader,
          policy,
        }),
      ],
    }).compile();

    await expect(module).rejects.toThrow('CACHE_MANAGER');
  });

  it('leaves direct self-injection to NestJS cycle diagnostics', async () => {
    @Injectable()
    class SelfReferencingReader {
      public constructor(@Inject('self-reader') readonly dependency: unknown) {}

      public findById(id: string): Promise<string> {
        return Promise.resolve(id);
      }
    }

    const module = Test.createTestingModule({
      providers: [
        ...rootProviders(),
        ...cachedProvider({
          provide: 'self-reader',
          useClass: SelfReferencingReader,
          policy,
        }),
      ],
    }).compile();

    await expect(module).rejects.toThrow('circular dependency');
  });
});

abstract class AbstractReader implements UserReader {
  public abstract findById(id: string): Promise<string>;
}

@Injectable()
class DefaultReader extends AbstractReader {
  public findById(id: string): Promise<string> {
    return Promise.resolve(`source:${id}`);
  }
}
