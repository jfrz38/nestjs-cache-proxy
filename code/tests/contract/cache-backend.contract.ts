import { CacheModule } from '@nestjs/cache-manager';
import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Keyv } from 'keyv';
import { describe, expect, it, vi } from 'vitest';

import { CacheProxyModule, defineCachePolicy } from '../../src/index.js';

interface User {
  readonly id: string;
  readonly name: string;
}

interface UserReader {
  findById(id: string): Promise<User | null | undefined>;
  update(id: string, name: string): Promise<User>;
}

const policy = defineCachePolicy<UserReader>()({
  resources: {
    userById: {
      method: 'findById',
      version: 1,
      ttl: 100,
      key: ([id]) => id,
    },
  },
  methods: {
    findById: { cache: 'userById' },
    update: {
      effects: [
        {
          invalidate: {
            keyArgs: ({ args }) => [args[0]] as [string],
            resource: 'userById',
          },
        },
        {
          writeThrough: {
            keyArgs: ({ result }) => [result.id] as [string],
            resource: 'userById',
            value: ({ result }) => result,
          },
        },
      ],
    },
  },
});

@Injectable()
class SourceUserReader implements UserReader {
  public static calls = 0;

  public findById(id: string): Promise<User | null | undefined> {
    SourceUserReader.calls += 1;
    if (id === 'missing') {
      return Promise.resolve(null);
    }
    if (id === 'undefined') {
      return Promise.resolve(undefined);
    }
    return Promise.resolve({ id, name: `source-${SourceUserReader.calls}` });
  }

  public update(id: string, name: string): Promise<User> {
    return Promise.resolve({ id, name });
  }
}

export interface BackendFixture {
  readonly createStore: (namespace: string) => Promise<Keyv>;
  readonly name: string;
}

export function describeCacheBackendContract(backend: BackendFixture): void {
  describe(`${backend.name} cache backend`, () => {
    async function createReader() {
      const store = await backend.createStore(
        `ncp-contract-${crypto.randomUUID()}`,
      );

      @Module({
        imports: [
          CacheModule.register({ isGlobal: true, stores: [store] }),
          CacheProxyModule.forRoot({
            namespace: { application: 'contract', environment: backend.name },
          }),
          CacheProxyModule.forFeature([
            {
              provide: SourceUserReader,
              useClass: SourceUserReader,
              policy,
            },
          ]),
        ],
      })
      class ContractModule {}

      const module = await Test.createTestingModule({
        imports: [ContractModule],
      }).compile();

      return {
        reader: module.get<UserReader>(SourceUserReader),
        close: async () => {
          await module.close();
          await store.clear();
          await store.disconnect();
        },
      };
    }

    it('caches hits, null values, and leaves undefined uncached', async () => {
      SourceUserReader.calls = 0;
      const fixture = await createReader();

      try {
        await expect(fixture.reader.findById('1')).resolves.toEqual({
          id: '1',
          name: 'source-1',
        });
        await expect(fixture.reader.findById('1')).resolves.toEqual({
          id: '1',
          name: 'source-1',
        });
        await expect(fixture.reader.findById('missing')).resolves.toBeNull();
        await expect(fixture.reader.findById('missing')).resolves.toBeNull();
        await expect(
          fixture.reader.findById('undefined'),
        ).resolves.toBeUndefined();
        await expect(
          fixture.reader.findById('undefined'),
        ).resolves.toBeUndefined();

        expect(SourceUserReader.calls).toBe(4);
      } finally {
        await fixture.close();
      }
    });

    it('expires entries using millisecond TTLs', async () => {
      SourceUserReader.calls = 0;
      const fixture = await createReader();

      try {
        await fixture.reader.findById('1');
        await vi.waitFor(
          async () => {
            await fixture.reader.findById('1');
            expect(SourceUserReader.calls).toBe(2);
          },
          { interval: 25, timeout: 2_000 },
        );
      } finally {
        await fixture.close();
      }
    });

    it('performs exact invalidation and write-through after mutations', async () => {
      SourceUserReader.calls = 0;
      const fixture = await createReader();

      try {
        await fixture.reader.findById('1');
        await fixture.reader.findById('2');
        await expect(fixture.reader.update('1', 'updated')).resolves.toEqual({
          id: '1',
          name: 'updated',
        });
        await expect(fixture.reader.findById('1')).resolves.toEqual({
          id: '1',
          name: 'updated',
        });
        await expect(fixture.reader.findById('2')).resolves.toEqual({
          id: '2',
          name: 'source-2',
        });

        expect(SourceUserReader.calls).toBe(2);
      } finally {
        await fixture.close();
      }
    });

    it('isolates entries between independently configured stores', async () => {
      SourceUserReader.calls = 0;
      const first = await createReader();
      const second = await createReader();

      try {
        await first.reader.findById('1');
        await second.reader.findById('1');
        expect(SourceUserReader.calls).toBe(2);
      } finally {
        await Promise.all([first.close(), second.close()]);
      }
    });
  });
}
