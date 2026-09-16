# nestjs-cache-proxy

Transparent, declarative caching for NestJS providers. Define cache behavior next to a
provider contract; the package supplies a proxy while your application continues to own
the cache backend and its operational configuration.

## Requirements

- Node.js 20.19.0 or later
- NestJS 11 or 12
- `@nestjs/cache-manager` and `cache-manager`

## Install

```sh
pnpm add nestjs-cache-proxy @nestjs/cache-manager cache-manager
```

## Quick start

Configure an application-owned `CacheModule` once, then add `CacheProxyModule.forRoot`.
The proxy module never creates or configures a cache backend.

```ts
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { CacheProxyModule } from 'nestjs-cache-proxy';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    CacheProxyModule.forRoot({
      namespace: { application: 'users-api', environment: 'production' },
    }),
  ],
})
export class ApplicationCacheModule {}
```

Describe which Promise-returning methods are cacheable with a typed policy:

```ts
import { defineCachePolicy } from 'nestjs-cache-proxy';

interface UserRepository {
  findById(id: string): Promise<{ id: string; name: string } | null>;
}

export const userCachePolicy = defineCachePolicy<UserRepository>()({
  resources: {
    userById: {
      method: 'findById',
      version: 1,
      ttl: 300_000,
      key: ([id]) => id,
    },
  },
  methods: {
    findById: { cache: 'userById' },
  },
});
```

Register the concrete singleton provider in its feature module. Consumers inject the
original token and receive the caching proxy.

```ts
import { Module } from '@nestjs/common';
import { CacheProxyModule } from 'nestjs-cache-proxy';
import { userCachePolicy } from './user-cache-policy.js';

class SqlUserRepository {
  public async findById(id: string) {
    return { id, name: 'Ada Lovelace' };
  }
}

@Module({
  imports: [
    CacheProxyModule.forFeature([
      {
        provide: SqlUserRepository,
        useClass: SqlUserRepository,
        policy: userCachePolicy,
      },
    ]),
  ],
  exports: [SqlUserRepository],
})
export class UsersModule {}
```

On a miss, the proxy calls the provider and attempts to write the result. Cache reads and
writes fail open; provider errors are returned unchanged. `null`, `false`, `0`, and empty
strings are cacheable. `undefined` is returned but not stored.

## Organizing cache registration

Keep cached-provider registration in the feature module by default. A dedicated cache module
is useful when a feature has several policies or when cache composition should remain separate
from the rest of the feature wiring. Prefer one such module per feature over a central module
that couples unrelated features.

Use `cachedProvider()` directly when the concrete implementation has constructor dependencies
from imported modules. NestJS does not make modules imported by a parent feature module visible
inside the dynamic module returned by `forFeature()`.

```ts
import { Injectable, Module } from '@nestjs/common';
import { cachedProvider } from 'nestjs-cache-proxy';
import { DatabaseClient, DatabaseModule } from '../database/database.module.js';
import { userCachePolicy } from './user-repository.cache-policy.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

@Injectable()
class SqlUserRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public findById(id: string) {
    return this.database.users.findById(id);
  }
}

@Module({
  imports: [DatabaseModule],
  providers: [
    ...cachedProvider({
      provide: USER_REPOSITORY,
      useClass: SqlUserRepository,
      policy: userCachePolicy,
    }),
  ],
  exports: [USER_REPOSITORY],
})
export class UsersCacheModule {}
```

Consumers import `UsersCacheModule` and inject `USER_REPOSITORY`. TypeScript interfaces cannot
be NestJS tokens because they do not exist at runtime; use a class, abstract class, string, or
symbol as the public token. The concrete class must be importable by the registration module,
but it does not need to be exported as a NestJS provider.

Policies are TypeScript objects rather than JSON configuration because key and value derivation
uses typed functions. Keep each policy close to the provider and module that register it. For a
repository cache, this is a useful optional layout:

```text
users/
  infrastructure/
    persistence/
      cache/
        user-repository.cache-policy.ts
        users-cache.module.ts
```

For cached use cases or other providers, place the policy with that feature's composition code
rather than under `persistence`.

## Mutations

Mutations run the provider first, then apply exact effects in declaration order. Use
`invalidate` to remove a known key or `writeThrough` to replace it with a canonical value.

```ts
const policy = defineCachePolicy<
  UserRepository & { rename(id: string, name: string): Promise<void> }
>()({
  resources: {
    userById: {
      method: 'findById',
      version: 1,
      ttl: 300_000,
      key: ([id]) => id,
    },
  },
  methods: {
    findById: { cache: 'userById' },
    rename: {
      effects: [{ invalidate: 'userById', keyArgs: ({ args }) => [args[0]] }],
    },
  },
});
```

Effects do not scan, delete by prefix, or perform atomic multi-key operations. Include
tenant identity in every tenant-scoped key input. Never include credentials, tokens, or
other sensitive data in keys because cache infrastructure can expose them.

## Testing

`nestjs-cache-proxy/testing` supplies a deterministic in-memory cache for application
tests. Override the application-owned `CACHE_MANAGER` with it; it is not a Redis or full
cache-manager emulator.

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createTestCache } from 'nestjs-cache-proxy/testing';

const testCache = createTestCache();
// Test.createTestingModule({ imports: [ApplicationModule] })
//   .overrideProvider(CACHE_MANAGER)
//   .useValue(testCache.cache);
await testCache.seed('a-key', { id: 'user-1' }, 60_000);
testCache.clock.advanceBy(60_000);
```

## Backends and compatibility

The default NestJS cache-manager store is supported. Redis is verified with the official
Keyv adapter configured by the application:

```ts
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

CacheModule.register({
  isGlobal: true,
  stores: [createKeyv('redis://127.0.0.1:6379')],
});
```

The backend contract was last verified on 2026-09-12:

| Node       | NestJS | `@nestjs/cache-manager` | `cache-manager` | Keyv  | `@keyv/redis` |
| ---------- | ------ | ----------------------- | --------------- | ----- | ------------- |
| 20, 22, 24 | 11.2.3 | 3.1.3                   | 7.2.9           | 5.6.0 | 5.1.6         |
| 20, 22, 24 | 12.0.1 | 12.0.0                  | 7.2.9           | 5.6.0 | 5.1.6         |

TTL is passed in milliseconds. Real backend expiration is eventually observable. The
contract does not certify Redis clusters, sentinel, TLS, administration commands, or every
Keyv adapter. Connection and retry configuration remain application-owned.

## Limitations

- Only Promise-returning methods can be configured.
- Cached providers must be singleton-scoped `useClass` providers.
- Invalidation is exact-key only.
- Concurrent misses are independent; an earlier read can repopulate stale data after a mutation.
- Effects are not transaction-aware and cannot be rolled back with a provider transaction.
- The package has no timeout policy; configure backend timeouts in the application.
- Values must be supported by the selected cache backend's serialization rules.
- Cache operations fail open; this does not make backend outages invisible to application monitoring.
- The proxy is not guaranteed to satisfy `instanceof` the concrete provider and must not be self-injected.

## Development

The publishable package lives in [`code/`](code/). Install dependencies and run fast checks:

```sh
make install
make check
```

Run `make release-check` before preparing a release. It includes coverage and memory/Redis
backend contracts; Redis validation requires a running Docker daemon. The command validates
the package but never publishes, tags, or creates a GitHub release.

- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)
