# nestjs-cache-proxy

Transparent, declarative caching for NestJS providers using DI, proxies, and cache-manager.

The typed cache-policy API, framework-independent runtime cache-aside proxy, and NestJS
singleton `useClass` provider integration are available.

## NestJS Providers

`cachedProvider` returns the provider definitions consumed by the upcoming
`CacheProxyModule.forFeature`. It registers the concrete implementation under an internal
symbol and publishes its caching proxy under the original token:

```ts
const providers = cachedProvider({
  provide: UserRepository,
  useClass: SqlUserRepository,
  policy: userCachePolicy,
});
```

Public tokens may be classes, abstract classes, strings, or symbols. The implementation must be
singleton-scoped; request and transient implementations fail before bootstrap. NestJS resolves its
constructor dependencies normally and invokes lifecycle hooks once on the concrete implementation.
The public proxy deliberately does not expose lifecycle hooks and is not guaranteed to satisfy
`instanceof SqlUserRepository`. A direct self-injection through the public token remains a NestJS
circular dependency.

Applications provide `CACHE_MANAGER` through `CacheModule` and the library root options in the
next dynamic-module iteration. Duplicate tokens are likewise validated by `forFeature`, not by an
individual `cachedProvider` descriptor.

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

The internal runtime compiles each policy into immutable read rules and validated value objects for
the namespace, resource, key version, TTL, and deterministic cache key. The public policy API
remains a plain object with numeric `version` and `ttl` fields. A configured read builds its key,
reads the cache, invokes the provider on a miss, awaits a best-effort write, and returns the
provider result. Cache get and set failures fail open; provider errors propagate unchanged.

The proxy preserves provider `this` binding, including ECMAScript private fields, and passes
through properties, symbols, accessors, unconfigured methods, and mutation rules. Wrapper identity
is stable per string-named method, but the proxy is not guaranteed to satisfy `instanceof` the
concrete provider class. Concurrent misses are independent; request coalescing is not included.

The runtime is composed from `CachePolicyCompiler`, `CacheAsideExecutor`, and
`CacheProxyFactory`. These framework-independent classes and their value objects are internal;
NestJS will compose them with a concrete cache adapter in a later iteration.

Until the value envelope arrives in the next resilience iteration, `null` and `undefined` from a
cache store are misses. Provider `null` and `undefined` results are returned but not stored; other
falsy values such as `false`, `0`, and `''` are cacheable.

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
- `make test-coverage`: runs Vitest with V8 coverage reporting.
- `make build`: emits ESM, CommonJS, declarations, and source maps.
- `make pack-check`: verifies the packed tarball from ESM, CommonJS, and TypeScript consumers.

## Compatibility

The package targets Node.js 20, 22, and 24, plus NestJS 11 and 12. The CI matrix
validates the declared NestJS, `@nestjs/cache-manager`, and `cache-manager` peer
combinations through a packed consumer.

## Package layout

`code/package.json` is the package manifest. The root `README.md` and `LICENSE` remain
the documentation sources of truth; packaging copies them temporarily into `code/` so
the npm tarball contains both files without maintaining duplicates.

- [Architecture](docs/architecture.md)
- [Implementation iterations](docs/iterations/README.md)
