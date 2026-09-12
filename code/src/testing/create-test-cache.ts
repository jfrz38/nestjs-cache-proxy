import type { Cache } from 'cache-manager';

import {
  CacheEnvelope,
  CacheEnvelopeState,
} from '../application/runtime/cache-envelope.js';
import { ManualTestClock, type TestClock } from './test-clock.js';

export type TestCacheManager = Pick<Cache, 'del' | 'get' | 'set'>;

export interface TestCacheEntry {
  readonly expiresAt: number | undefined;
  readonly key: string;
  readonly value: unknown;
}

export type TestCacheOperation =
  | {
      readonly at: number;
      readonly hit: boolean;
      readonly key: string;
      readonly type: 'get';
    }
  | {
      readonly at: number;
      readonly key: string;
      readonly type: 'delete';
    }
  | {
      readonly at: number;
      readonly expiresAt: number | undefined;
      readonly key: string;
      readonly ttl: number | undefined;
      readonly type: 'set';
      readonly value: unknown;
    };

export interface CreateTestCacheOptions {
  readonly initialTime?: number;
}

export interface TestCache {
  readonly cache: TestCacheManager;
  readonly clock: TestClock;
  entries(): readonly TestCacheEntry[];
  operations(): readonly TestCacheOperation[];
  reset(): void;
  seed(key: string, value: unknown, ttl?: number): Promise<void>;
}

interface StoredEntry {
  readonly expiresAt: number | undefined;
  readonly value: unknown;
}

export function createTestCache(
  options: CreateTestCacheOptions = {},
): TestCache {
  const clock = new ManualTestClock(options.initialTime);
  const entries = new Map<string, StoredEntry>();
  const operations: TestCacheOperation[] = [];

  function expire(key: string): StoredEntry | undefined {
    const entry = entries.get(key);
    if (entry?.expiresAt !== undefined && entry.expiresAt <= clock.now) {
      entries.delete(key);
      return undefined;
    }

    return entry;
  }

  const cache: TestCacheManager = {
    del(key) {
      const deleted = entries.delete(key);
      operations.push(
        Object.freeze({
          at: clock.now,
          key,
          type: 'delete',
        }),
      );
      return Promise.resolve(deleted);
    },
    get<Value>(key: string): Promise<Value | undefined> {
      const entry = expire(key);
      operations.push(
        Object.freeze({
          at: clock.now,
          hit: entry !== undefined,
          key,
          type: 'get',
        }),
      );
      return Promise.resolve(entry?.value as Value | undefined);
    },
    set<Value>(key: string, value: Value, ttl?: number): Promise<Value> {
      const expiresAt = ttl === undefined ? undefined : clock.now + ttl;
      entries.set(key, { expiresAt, value });
      operations.push(
        freezeSnapshot({
          at: clock.now,
          expiresAt,
          key,
          ttl,
          type: 'set',
          value: inspectValue(value),
        }),
      );
      return Promise.resolve(value);
    },
  };

  return {
    cache,
    clock,
    entries() {
      for (const key of entries.keys()) {
        expire(key);
      }

      return Object.freeze(
        [...entries.entries()].map(([key, entry]) =>
          freezeSnapshot({
            expiresAt: entry.expiresAt,
            key,
            value: inspectValue(entry.value),
          }),
        ),
      );
    },
    operations() {
      return Object.freeze(
        operations.map((operation) => freezeSnapshot(operation)),
      );
    },
    reset() {
      entries.clear();
      operations.length = 0;
      clock.reset();
    },
    async seed(key, value, ttl) {
      const envelope = CacheEnvelope.encode(value);
      if (envelope !== undefined) {
        await cache.set(key, envelope, ttl);
      }
    },
  };
}

function inspectValue(value: unknown): unknown {
  const decoded = CacheEnvelope.decode(value);
  return decoded.state === CacheEnvelopeState.HIT ? decoded.value : value;
}

function freezeSnapshot<T>(value: T): T {
  return freeze(structuredClone(value), new WeakSet<object>());
}

function freeze<T>(value: T, seen: WeakSet<object>): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }

  seen.add(value);
  for (const nested of Object.values(value)) {
    freeze(nested, seen);
  }
  return Object.freeze(value);
}
