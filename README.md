# NestJS Cache Proxy

**Add caching to your NestJS services and repositories without changing how the rest of your application uses them.**

[![CI](https://github.com/jfrz38/nestjs-cache-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/jfrz38/nestjs-cache-proxy/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40jfrz38%2Fnestjs-cache-proxy)](https://www.npmjs.com/package/@jfrz38/nestjs-cache-proxy)
[![npm downloads](https://img.shields.io/npm/dm/%40jfrz38%2Fnestjs-cache-proxy)](https://www.npmjs.com/package/@jfrz38/nestjs-cache-proxy)
[![Node.js](https://img.shields.io/node/v/%40jfrz38%2Fnestjs-cache-proxy)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11%20%7C%2012-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![License](https://img.shields.io/npm/l/%40jfrz38%2Fnestjs-cache-proxy)](https://github.com/jfrz38/nestjs-cache-proxy/blob/main/LICENSE)

`@jfrz38/nestjs-cache-proxy` wraps your existing NestJS providers with a cache-aware proxy,
keeping cache keys, TTLs, and invalidation rules in a typed policy instead of scattering
cache logic throughout your application.

Choose which methods should be cached and how long their results should live. The first
call runs your class as usual; later calls can reuse the cached result. Everything that
depends on that class keeps working as before.

You keep control of the cache itself. Use NestJS `CacheModule` with its default in-memory
store, Redis, or another compatible backend.

## Contents

- [Why use it?](#why-use-it)
- [Get started](#get-started)
- [Examples](#examples)
- [Keep cached data fresh](#keep-cached-data-fresh)
- [Organizing cache registration](#organizing-cache-registration)
- [Testing](#testing)
- [Backends and compatibility](#backends-and-compatibility)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)

## Why use it?

- Add caching without putting cache reads and writes inside your services or repositories.
- Keep controllers and other consumers unchanged.
- Choose exactly which methods are cached and when their entries should be removed or updated.
- Keep using the NestJS cache setup and backend your application already owns.
- Keep returning your class's result when a cache operation fails.
- Catch invalid method names and arguments through TypeScript.

## Get started

`@jfrz38/nestjs-cache-proxy` requires Node.js 22.13.0 or later and supports NestJS 11 and 12.
Install it together with the NestJS cache packages:

```sh
npm install @jfrz38/nestjs-cache-proxy @nestjs/cache-manager cache-manager
```

### 1. Configure your cache

Register your application cache once, then add `CacheProxyModule.forRoot()`. The package
uses this cache but never creates or configures a backend for you.

```ts
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { CacheProxyModule } from '@jfrz38/nestjs-cache-proxy';

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

### 2. Choose what to cache

Create a policy for the Promise-returning methods you want to cache. Here, every user is
cached by ID for five minutes:

```ts
import { defineCachePolicy } from '@jfrz38/nestjs-cache-proxy';

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

### 3. Register your class

Connect the class to its policy in the feature module. Existing consumers continue to
inject `SqlUserRepository` and automatically receive the cached behavior.

```ts
import { Module } from '@nestjs/common';
import { CacheProxyModule } from '@jfrz38/nestjs-cache-proxy';
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

That is all the consuming code needs to know. It calls `findById()` as before while the
registered policy handles cache reads and writes around it.

## How it works

For a cached method call, the package:

1. Builds a key from the method arguments.
2. Returns the stored value when one exists.
3. Otherwise calls your class and stores its result for the configured time.

Cache reads and writes fail open: a cache error does not replace the result or error from
your class. `null`, `false`, `0`, and empty strings can be cached. `undefined` is returned
but is not stored.

Any singleton NestJS `useClass` provider can be registered when its configured methods
return Promises. This works well for repositories, query services, and use cases. Cache the
provider called by a controller rather than the controller itself.

## Examples

The repository contains small, compilable recipes for common composition choices. They are
tested against the packed npm artifact but are not included in the published package.

| Recipe                                                                                                       | What it demonstrates                                                   |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [Cache in a repository](https://github.com/jfrz38/nestjs-cache-proxy/tree/main/examples/cache-in-repository) | Share a cached read and invalidate its exact key after a mutation.     |
| [Cache in a use case](https://github.com/jfrz38/nestjs-cache-proxy/tree/main/examples/cache-in-use-case)     | Cache one application operation while leaving its dependency uncached. |
| [Cross-module cache](https://github.com/jfrz38/nestjs-cache-proxy/tree/main/examples/cross-module-cache)     | Export a cached provider from its owning module to another module.     |
| [Redis backend](https://github.com/jfrz38/nestjs-cache-proxy/tree/main/examples/redis-backend)               | Configure Redis as the application-owned cache-manager store.          |

There is no universal cache boundary. Repository caching can share entries across several
operations, while use-case caching can represent the complete result of one operation. Each
recipe explains the trade-offs and the application-specific values that need replacing.

## Keep cached data fresh

After a successful update, a policy can remove an old entry with `invalidate` or replace it
with a new value using `writeThrough`. Updates always run your class first; cache effects
only run when that call succeeds.

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

Effects target exact keys. They do not scan the cache, delete by prefix, or perform atomic
multi-key operations. Include tenant identity in every tenant-specific key. Never include
credentials, tokens, or other sensitive data because cache infrastructure can expose keys.

Increment a resource's `version` when its key meaning or stored value becomes incompatible.
Changing the version isolates new entries; it does not migrate or remove entries written by
an older version.

## Organizing cache registration

Keep cached-provider registration in the feature module by default. A dedicated cache module
is useful when a feature has several policies or when cache composition should remain separate
from the rest of the feature wiring. Prefer one such module per feature over a central module
that couples unrelated features.

| Registration                    | Prefer it when                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `CacheProxyModule.forFeature()` | The dynamic module can construct the cached class from dependencies visible to it.                    |
| `cachedProvider()`              | The cached class depends on providers owned or imported by the feature module doing the registration. |

Use `cachedProvider()` directly when the concrete implementation has constructor dependencies
from imported modules. NestJS does not make modules imported by a parent feature module visible
inside the dynamic module returned by `forFeature()`.

```ts
import { Injectable, Module } from '@nestjs/common';
import { cachedProvider } from '@jfrz38/nestjs-cache-proxy';
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

## Testing

`@jfrz38/nestjs-cache-proxy/testing` provides a deterministic in-memory cache for application tests.
Override the application-owned `CACHE_MANAGER` with it, seed the values a test needs, and move
its clock forward without waiting in real time. It is not a Redis or full cache-manager emulator.

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createTestCache } from '@jfrz38/nestjs-cache-proxy/testing';

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

## Troubleshooting

### NestJS cannot resolve a cached provider dependency

Modules imported by a parent feature module are not automatically visible inside the dynamic
module returned by `forFeature()`. Register the provider with `cachedProvider()` in the parent
module so it can use that module's imports and providers.

### A TypeScript interface cannot be injected

Interfaces do not exist at runtime. Use a class, abstract class, string, or symbol as the
`provide` token and inject the interface only as its TypeScript type.

### An entry survives a deployment with changed data

Increment the affected resource's `version` when the key semantics or cached value format
changes. Old entries remain in the backend until their own TTL expires or the application
removes them operationally.

### Expiration is not immediate

TTL values are milliseconds, and expiration timing depends on the selected backend. Test the
behavior with the same adapter and configuration used by the application.

### Cache failures do not fail the request

Cache operations deliberately fail open. Configure the `onCacheError` hook to report failures
to the application's logging or monitoring system.

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

The publishable package lives in `code/`. Install dependencies and run the project checks:

```sh
make install
make check
```

Build a local package tarball and install that exact artifact in another project:

```sh
make pack-local
pnpm add --force "$(pwd)/code/.artifacts/"*.tgz
```

From the consumer project, remove and reinstall the package to force pnpm to read the
fresh tarball when its version has not changed:

```sh
pnpm remove @jfrz38/nestjs-cache-proxy
pnpm add --force "/path/to/nestjs-cache-proxy/code/.artifacts/"*.tgz
```

The target builds the package first, removes older local tarballs, and writes the new
artifact to `code/.artifacts/`. Removing the dependency before `pnpm add --force` ensures
the changed declarations are picked up even when its package version has not changed.
If the consumer still resolves an older declaration, remove the package's virtual-store
directory before adding it again:

```sh
rm -rf node_modules/.pnpm/@jfrz38+nestjs-cache-proxy@*
pnpm add --force "/path/to/nestjs-cache-proxy/code/.artifacts/"*.tgz
```

This validates the packaged output without creating a symlink or publishing a release.
For editable development, use `pnpm link` instead.

Run `make release-check` before preparing a release. It includes coverage and memory/Redis
backend contracts; Redis validation requires a running Docker daemon. The command validates
the package but never publishes, tags, or creates a GitHub release.

- [Architecture](https://github.com/jfrz38/nestjs-cache-proxy/blob/main/docs/architecture.md)
- [Contributing](https://github.com/jfrz38/nestjs-cache-proxy/blob/main/CONTRIBUTING.md)
- [Changelog](https://github.com/jfrz38/nestjs-cache-proxy/blob/main/CHANGELOG.md)
- [Security policy](https://github.com/jfrz38/nestjs-cache-proxy/blob/main/SECURITY.md)
