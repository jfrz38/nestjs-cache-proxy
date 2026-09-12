# nestjs-cache-proxy

Transparent, declarative caching for NestJS providers using DI, proxies, and cache-manager.

The typed cache-policy API, framework-independent runtime cache-aside proxy, and NestJS
dynamic-module provider integration are available.

## NestJS Providers

Configure the library once alongside an application-owned global `CacheModule`. `forRoot` only
normalizes the namespace; it never registers a cache backend. Its global options provider allows
feature modules to keep the documented `forFeature(registrations)` API:

```ts
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

Feature modules register and export their public cached tokens explicitly:

```ts
@Module({
  imports: [
    CacheProxyModule.forFeature([
      {
        provide: UserRepository,
        useClass: SqlUserRepository,
        policy: userCachePolicy,
      },
    ]),
  ],
})
export class UsersModule {}
```

`forFeature` delegates each descriptor to `cachedProvider`, which registers the concrete
implementation under an internal symbol and publishes its caching proxy under the original token.
Public tokens may be classes, abstract classes, strings, or symbols. Implementations must be
singleton-scoped; request and transient implementations fail before bootstrap. NestJS resolves
constructor dependencies normally and invokes lifecycle hooks once on the concrete implementation.
The public proxy deliberately does not expose lifecycle hooks and is not guaranteed to satisfy
`instanceof SqlUserRepository`. A direct self-injection through the public token remains a NestJS
circular dependency.

Call `forRoot` once per application context. Duplicate roots and duplicate tokens across separate
feature modules follow NestJS module-composition semantics and are unsupported; duplicate public
tokens within one `forFeature` call fail immediately. A feature token is visible only to modules
that import the feature module. `CacheProxyModule` does not import `CacheModule`: applications must
make `CACHE_MANAGER` globally available as shown above, or provide it through an equivalent global
application module.

## Typed Policies

Policies are plain, inline objects. A resource declares the Promise-returning method that
defines its key arguments and cached result contract:

```ts
const userCachePolicy = defineCachePolicy<UserRepository>()({
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

Only Promise-returning methods may be configured. Read rules use `cache`; mutations use a
non-empty ordered `effects` list with exact `invalidate` or `writeThrough` effects.

## Runtime Cache-Aside

The internal runtime validates each policy once and compiles immutable read and mutation rules with
validated value objects for the namespace, resource, key version, TTL, and deterministic cache key.
The public policy API remains a plain object with numeric `version` and `ttl` fields. A configured
read builds its key, reads the cache, invokes the provider on a miss, awaits a best-effort write,
and returns the provider result. Cache get and set failures fail open; provider errors propagate
unchanged.

For a configured mutation, the provider completes first, then exact invalidation and write-through
effects run in declaration order. Every dynamic target needs `keyArgs({ args, result })`; it may be
omitted only for a resource whose key builder declares no arguments. Write-through requires an
explicit canonical `value({ args, result })`. Delete and set failures are reported through an
internal, non-throwing seam and do not change the provider result. Effects never perform scans,
prefix deletion, or atomic multi-key operations.

The proxy preserves provider `this` binding, including ECMAScript private fields, and passes
through properties, symbols, accessors, and unconfigured methods. Wrapper identity is stable per
string-named method, but the proxy is not guaranteed to satisfy `instanceof` the concrete provider
class. Concurrent misses are independent: a read started before a mutation can still repopulate a
stale entry after its effect completes. Transaction rollback can likewise leave an early effect;
use bounded TTLs until post-commit integration exists.

The runtime is composed from `CachePolicyCompiler`, `CacheAsideExecutor`, and
`CacheProxyFactory`. These framework-independent classes and their value objects are internal;
NestJS composes them with the application's `CACHE_MANAGER`.

The runtime stores a private value envelope so a cached `null` is a hit. `undefined` from a cache
store is a miss, and provider `undefined` results are returned but not stored. Other falsy values
such as `false`, `0`, and `''` are cacheable.

## Cache Keys

`buildCacheKey` exposes the deterministic `k1` contract used by later runtime iterations:

```ts
const key = buildCacheKey({
  namespace: { application: 'users-api', environment: 'production' },
  resource: 'userById',
  version: 1,
  input: { tenantId: 'tenant-1', id: 'user-1' },
});
```

The resulting key starts with `ncp:k1:` followed by tagged canonical JSON. It distinguishes
types such as `1` and `'1'`, preserves `-0`, recursively orders object keys, and encodes
delimiters safely. The `input` accepts only `null`, booleans, finite numbers, strings, dense
arrays, and plain string-keyed objects. It rejects cycles, accessors, sparse arrays, class
instances, collections, symbols, functions, `BigInt`, and non-finite numbers.

Validation failures extend `CacheKeyValidationError`. Consumers that need to handle a specific
rule can use `InvalidCacheKeyNamespaceError`, `InvalidCacheKeyResourceError`,
`InvalidCacheKeyVersionError`, or `InvalidCacheKeyInputError`; each has a stable `code` and
does not include raw key input in its message.

Include tenant identity in `input` whenever data is tenant-scoped. Do not include secrets,
credentials, tokens, or other sensitive values: keys can be visible to cache infrastructure.
Resource versions isolate incompatible entries; a version bump neither migrates nor deletes
older entries. The `k1` payload is a persistent contract, so future representation changes
must introduce a new format version.

## Testing

`nestjs-cache-proxy/testing` provides a deterministic in-memory cache for consumer tests. It has
only the `get`, `set`, and `del` cache-manager operations used by this package, so inject
`testCache.cache` when overriding the application-owned `CACHE_MANAGER`.

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  buildPolicyCacheKey,
  createTestCache,
  TestCacheOperationType,
} from 'nestjs-cache-proxy/testing';

const testCache = createTestCache();
const module = await Test.createTestingModule({ imports: [ApplicationModule] })
  .overrideProvider(CACHE_MANAGER)
  .useValue(testCache.cache)
  .compile();

const key = buildPolicyCacheKey({
  args: ['user-1'],
  namespace: { application: 'users-api', environment: 'test' },
  policy: userCachePolicy,
  resource: 'userById',
});

await testCache.seed(key, { id: 'user-1' }, 60_000);
testCache.clock.advanceBy(60_000);
expect(testCache.entries()).toEqual([]);
expect(testCache.operations()).toContainEqual(
  expect.objectContaining({ key, type: TestCacheOperationType.GET }),
);
```

The manual clock starts at zero, advances only through `advanceBy`, and `reset()` clears entries,
operations, and time. Inspection returns detached immutable snapshots with logical values, not the
library's private cache envelope. The test cache is not a Redis or full cache-manager emulator;
backend-specific behavior belongs in compatibility tests. Cache keys and inspection records can
still contain test data, so do not place credentials or other sensitive values in them.

## Requirements

- Node.js 20.19.0 or later
- pnpm 12.3.4
- GNU Make

## Development

The publishable package lives in [`code/`](code/). Root-level commands provide the
canonical contributor interface:

```sh
make install
make check
```

Available checks:

- `make format-check`: verifies Prettier formatting for source and Markdown.
- `make lint`: lints TypeScript and Markdown.
- `make typecheck`: performs strict TypeScript validation without emitting files.
- `make test`: runs Vitest tests.
- `make test-backend`: runs the shared cache contract against the in-memory Keyv store.
- `make test-backend-redis`: starts a pinned ephemeral Redis container and runs the same
  contract against `@keyv/redis`; it requires a running Docker daemon.
- `make test-backend-all`: runs both backend contract configurations.
- `make test-coverage`: runs Vitest with V8 coverage reporting.
- `make build`: emits ESM, CommonJS, declarations, and source maps.
- `make pack-check`: verifies the packed tarball from ESM, CommonJS, and TypeScript consumers.

## Compatibility

The package targets Node.js 20, 22, and 24, plus NestJS 11 and 12. CI executes the
same cache behavior contract against memory and a pinned Redis/Keyv configuration for
each NestJS/Node pair. The peer ranges describe supported resolution space; the exact
versions and known backend differences are maintained in
[the compatibility guide](docs/compatibility.md).

## Package layout

`code/package.json` is the package manifest. The root `README.md` and `LICENSE` remain
the documentation sources of truth; packaging copies them temporarily into `code/` so
the npm tarball contains both files without maintaining duplicates.

- [Architecture](docs/architecture.md)
- [Implementation iterations](docs/iterations/README.md)
