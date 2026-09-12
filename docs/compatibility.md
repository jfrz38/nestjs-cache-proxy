# Backend Compatibility

## CI compatibility matrix

The `backend-compatibility` CI job executes the same public NestJS cache-provider
contract for every row below. It prints the resolved dependency versions with its test
output. The job uses the pinned `redis:8.10.1-alpine` image and does not depend on a
developer-managed Redis server.

| Node | NestJS | `@nestjs/cache-manager` | `cache-manager` | Keyv  | `@keyv/redis` |
| ---- | ------ | ----------------------- | --------------- | ----- | ------------- |
| 20   | 11.2.3 | 3.1.3                   | 7.2.9           | 5.6.0 | 5.1.6         |
| 22   | 11.2.3 | 3.1.3                   | 7.2.9           | 5.6.0 | 5.1.6         |
| 24   | 11.2.3 | 3.1.3                   | 7.2.9           | 5.6.0 | 5.1.6         |
| 20   | 12.0.1 | 12.0.0                  | 7.2.9           | 5.6.0 | 5.1.6         |
| 22   | 12.0.1 | 12.0.0                  | 7.2.9           | 5.6.0 | 5.1.6         |
| 24   | 12.0.1 | 12.0.0                  | 7.2.9           | 5.6.0 | 5.1.6         |

## Supported backend configurations

Memory uses the application-owned default `CacheModule` store. The distributed setup
uses the official Keyv Redis adapter:

```ts
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

CacheModule.register({
  isGlobal: true,
  stores: [createKeyv('redis://127.0.0.1:6379')],
});
```

The cache proxy does not configure a backend. Applications import `CacheModule` and
provide `CACHE_MANAGER`; then they compose `CacheProxyModule.forRoot()` and
`CacheProxyModule.forFeature()`.

## Local verification

Run the memory contract without Docker:

```sh
make test-backend
```

Run Redis through Docker:

```sh
make test-backend-redis
```

The Redis command starts a unique ephemeral container, selects an available host port,
waits for `PING`, and force-removes the container on success or failure. If Docker is
not running, start it and repeat the command. CI connects directly to its ephemeral
Redis service through `REDIS_URL`.

## Backend boundaries

- TTL is passed to cache-manager in milliseconds. Real backend expiry is eventually
  observable, so the compatibility contract uses bounded polling rather than fixed
  sleeps.
- `null` and falsy values are stored in the library envelope; `undefined` is never
  cached.
- The contract covers cache-aside, exact invalidation, and write-through. It does not
  certify Redis clusters, sentinel, TLS, administration commands, or every Keyv adapter.
- Cache-operation failures fail open at the library boundary. Adapter connection and
  retry settings remain application-owned and must be configured to suit the deployment.
