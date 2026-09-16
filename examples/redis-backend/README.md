# Redis backend

## What this recipe shows

The application configures Redis as its cache-manager backend and then registers
the same kind of cached provider used by the in-memory examples. Redis stores
cache entries only; `InMemoryBookReader` still represents the application's data
source.

## Things to consider

A shared backend can be useful when multiple application instances need to reuse
the same entries. It also introduces network latency, serialization constraints,
connection failures, and operational responsibility that an in-process cache
does not have.

Changing the backend does not change the cache policy. Backend timeouts, retries,
TLS, authentication, clusters, and sentinel configuration remain application
concerns. Cache operations fail open, but failures should still be observable.

## How it works

`CacheModule.register()` receives the Keyv Redis store. `CacheProxyModule.forRoot()`
uses that application-owned cache, and `forFeature()` registers the reader proxy.
`BookReader.findById()` is cached for 60 seconds using the book ID as its key.

The example reads `REDIS_URL` and falls back to
`redis://127.0.0.1:6379` for local development. A reachable Redis server is
required, together with `@keyv/redis`, `@nestjs/cache-manager`, and
`cache-manager`.

## Files

| File                          | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| `book-reader.ts`              | Cached reader token and contract.            |
| `book-reader.cache-policy.ts` | Backend-independent cache policy.            |
| `in-memory-book-reader.ts`    | Illustrative application data source.        |
| `redis-backend.module.ts`     | Redis store and cached-provider composition. |

## Adapt the recipe

Move connection details into validated application configuration, replace the
in-memory reader, and choose a namespace that separates applications and
environments. Do not put credentials or other sensitive values in cache keys.
