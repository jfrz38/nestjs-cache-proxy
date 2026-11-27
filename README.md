# NestJS Cache Proxy

<div align="center">

**Cache NestJS providers without changing their consumers.**

[![CI](https://github.com/jfrz38/nestjs-cache-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/jfrz38/nestjs-cache-proxy/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40jfrz38%2Fnestjs-cache-proxy)](https://www.npmjs.com/package/@jfrz38/nestjs-cache-proxy)
[![npm downloads](https://img.shields.io/npm/dm/%40jfrz38%2Fnestjs-cache-proxy)](https://www.npmjs.com/package/@jfrz38/nestjs-cache-proxy)
[![License](https://img.shields.io/npm/l/%40jfrz38%2Fnestjs-cache-proxy)](./LICENSE)

</div>

`@jfrz38/nestjs-cache-proxy` adds cache-aside behavior to existing NestJS
services, repositories, and use cases. Define cache keys, time to live (TTL),
and invalidation rules in a typed policy, then keep injecting the same provider
token everywhere else.

Your application still owns `CacheModule` and its backend. The library only
wraps selected provider methods with cache behavior.

## Quick start

### Requirements

- Node.js 22.13.0 or later
- NestJS 11 or 12

Install the package and the NestJS cache dependencies:

```sh
npm install @jfrz38/nestjs-cache-proxy @nestjs/cache-manager cache-manager
```

### 1. Define a provider and its cache policy

The policy below caches each user by ID for five minutes:

```ts
import { Injectable } from '@nestjs/common';
import { defineCachePolicy } from '@jfrz38/nestjs-cache-proxy';

@Injectable()
export class UserRepository {
  public async findById(id: string) {
    console.log(`[database] loading user ${id}`);
    return { id, name: 'Ada Lovelace' };
  }

  public async rename(id: string, name: string): Promise<void> {
    console.log(`[database] renaming user ${id} to ${name}`);
  }
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

### 2. Register the cached provider

Register the implementation under its existing token. Consumers can keep
injecting `UserRepository`.

```ts
import { Module } from '@nestjs/common';
import { CacheProxyModule } from '@jfrz38/nestjs-cache-proxy';
import { UserRepository, userCachePolicy } from './user.repository.js';

@Module({
  imports: [
    CacheProxyModule.forFeature([
      {
        provide: UserRepository,
        useClass: UserRepository,
        policy: userCachePolicy,
      },
    ]),
  ],
  exports: [UserRepository],
})
export class UsersModule {}
```

### 3. Connect the application cache

Configure `CacheModule` once, then initialize the cache proxy with a namespace
for the application and environment:

```ts
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { CacheProxyModule } from '@jfrz38/nestjs-cache-proxy';
import { UsersModule } from './users.module.js';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    CacheProxyModule.forRoot({
      namespace: {
        application: 'users-api',
        environment: 'production',
      },
    }),
    UsersModule,
  ],
})
export class AppModule {}
```

Call the provider as usual:

```ts
await userRepository.findById('user-1');
await userRepository.findById('user-1');
```

The provider runs only on the first call, so the application prints this line
once:

```text
[database] loading user user-1
```

The second call returns the cached result through the same
`UserRepository.findById()` contract.

## How it works

For each configured read, the proxy:

1. Builds a deterministic, versioned key from the method arguments.
2. Returns the stored value on a cache hit.
3. Calls the provider on a miss and stores its result with the configured TTL.

`null`, `false`, `0`, and empty strings can be cached. `undefined` is returned
but is not stored.

Cache reads, writes, and effects fail open: a cache failure does not replace the
provider result or error. Use the optional `onCacheEvent` hook to send those
failures to your application's logs or monitoring.

## Keep cached data fresh

A mutation can invalidate an exact cache key or replace its value with
write-through behavior. The provider always runs first; effects run only after
the method succeeds.

```ts
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
    rename: {
      effects: [
        {
          invalidate: 'userById',
          keyArgs: ({ args }) => [args[0]],
        },
      ],
    },
  },
});
```

Effects target exact keys. They do not scan the cache, delete by prefix, or
perform atomic multi-key operations. Increment a resource's `version` when its
key meaning or stored value becomes incompatible.

Include tenant identity in tenant-specific keys. Never include credentials,
tokens, or other secrets in cache keys.

## Choose a registration style

| Registration                    | Use it when                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `CacheProxyModule.forFeature()` | The dynamic module can construct the provider from dependencies visible to it.                    |
| `cachedProvider()`              | The provider depends on modules imported by the feature module that owns the registration.        |
| `cachedProviderAsync()`         | The policy depends on an injected provider such as `ConfigService`, or is created asynchronously. |

NestJS does not make a parent module's imports visible inside the dynamic module
returned by `forFeature()`. In that case, spread `cachedProvider()` into the
parent module's `providers` array.

Use `cachedProviderAsync()` when policy values such as TTL come from dependency
injection. Its factory may return a policy or a `Promise` of one, and its
injected dependencies must be visible to the module that registers the provider.

See the [examples](./examples/README.md) for complete composition recipes:

- [Cache in a repository](./examples/cache-in-repository/README.md)
- [Cache in a use case](./examples/cache-in-use-case/README.md)
- [Cross-module cache](./examples/cross-module-cache/README.md)
- [Redis backend](./examples/redis-backend/README.md)

## Test cached providers

The `@jfrz38/nestjs-cache-proxy/testing` entry point provides a deterministic
in-memory cache for application tests:

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { createTestCache } from '@jfrz38/nestjs-cache-proxy/testing';

const testCache = createTestCache();

const testingModule = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideProvider(CACHE_MANAGER)
  .useValue(testCache.cache)
  .compile();

testCache.clock.advanceBy(60_000);
```

You can seed entries, inspect cache operations, and advance time without
waiting. The test cache is not a Redis or full cache-manager emulator.

## Backends and compatibility

| Dependency              | Supported versions |
| ----------------------- | ------------------ |
| Node.js                 | `>=22.13.0`        |
| NestJS                  | 11 and 12          |
| `@nestjs/cache-manager` | 3 and 12           |
| `cache-manager`         | 6 and 7            |

The default in-memory store and Redis through the official Keyv adapter are
covered by backend contract tests. Backend credentials, serialization,
timeouts, retries, connection handling, and operational monitoring remain
application concerns.

## Limitations

- Only Promise-returning methods can be configured.
- Cached providers must be singleton-scoped `useClass` providers.
- Invalidation targets exact keys only.
- Concurrent misses are independent; requests are not coalesced.
- Cache effects are not transaction-aware and cannot be rolled back with a
  provider transaction.
- The proxy is not guaranteed to satisfy `instanceof` for the concrete
  implementation and must not inject itself.
- Values must follow the selected backend's serialization rules.

Review the [architecture guide](./docs/architecture.md) for key formats,
failure semantics, package boundaries, and other design details.

## Development

The publishable package lives in `code/`. Install its locked dependencies and
run the project checks from the repository root:

```sh
make install
make check
```

See the [contribution guide](./CONTRIBUTING.md) for the complete development and
release verification workflow.

## Project resources

- [Examples](./examples/README.md)
- [Architecture](./docs/architecture.md)
- [Changelog](./CHANGELOG.md)
- [Security policy](./SECURITY.md)

## License

Licensed under the [MIT License](./LICENSE).
