# Architecture

## Purpose

`nestjs-cache-proxy` adds cache-aside behavior to selected methods of NestJS singleton
providers. Consumers keep their provider contracts and application-owned cache-manager setup;
the library composes a proxy around the concrete provider.

The package supports two public entry points:

- `nestjs-cache-proxy` for policy definition, cache keys, provider registration, and NestJS
  module composition.
- `nestjs-cache-proxy/testing` for deterministic test cache utilities.

Internal compiler, runtime, envelope, token, and proxy implementation types are intentionally
not package exports.

## Boundaries

The domain layer defines cache policy and key contracts without NestJS or cache-manager imports.
The application runtime compiles validated policies and executes reads and effects against a
small cache operation boundary. NestJS infrastructure adapts that runtime to `CACHE_MANAGER`
and registers cached providers.

Applications own these decisions:

- `CacheModule` registration, stores, credentials, timeout, retry, and observability settings.
- Provider tokens, concrete singleton `useClass` implementations, and feature-module exports.
- Namespaces, resource versions, TTLs, and tenant-scoped key inputs.

The proxy module does not import or configure `CacheModule`. An application must expose
`CACHE_MANAGER` through its own global module or an equivalent composition boundary.

## NestJS composition

`CacheProxyModule.forRoot(options)` normalizes and exports global namespace options. It is called
once per application context. `CacheProxyModule.forFeature(registrations)` turns each
`cachedProvider` descriptor into an internal concrete provider plus a proxy under the original
public token.

Only singleton-scoped `useClass` providers are supported. NestJS constructs the concrete provider,
resolves its constructor dependencies, and invokes lifecycle hooks once. The public proxy preserves
method `this` binding and passes through unconfigured methods, properties, symbols, and accessors,
but is not guaranteed to satisfy `instanceof` the implementation. Self-injection through the
public token remains a NestJS circular dependency.

Duplicate public tokens in one feature registration fail immediately. Token visibility follows
ordinary NestJS feature-module exports.

## Policies and keys

`defineCachePolicy<T>()` produces a plain typed policy. A resource names a Promise-returning method,
resource version, TTL in milliseconds, and a key builder. Methods either select a read resource with
`cache` or declare a non-empty ordered mutation `effects` list.

Policies are validated once and compiled into immutable runtime rules. A key has the stable `k1`
format and includes namespace, resource, version, and canonical structured input. The accepted input
is limited to null, booleans, finite numbers, strings, dense arrays, and plain string-keyed objects.
Cycles, accessors, sparse arrays, class instances, collections, functions, symbols, `BigInt`, and
non-finite numbers are rejected.

Keys distinguish values such as `1` and `'1'`, preserve `-0`, and sort object keys. Resource-version
increments isolate incompatible values; they neither migrate nor delete entries from earlier versions.
Sensitive material must never be used in keys.

## Read and mutation semantics

A configured read derives a key, reads the cache, calls the provider on a miss, then attempts a
cache write. Cache reads and writes fail open, while provider errors propagate unchanged. A private
envelope distinguishes a cached `null` from a miss. `undefined` is never stored; other falsy values
are cacheable.

A configured mutation calls the provider first. It then runs exact invalidation or write-through
effects in declaration order. Dynamic targets require `keyArgs({ args, result })` unless their key
builder accepts no arguments. Write-through requires an explicit canonical `value({ args, result })`.
Cache effect failures are reported through a non-throwing internal seam and do not change the
provider result.

No scans, prefix deletes, atomic multi-key operations, request coalescing, or transaction hooks are
provided. An earlier concurrent read can repopulate a stale value after a mutation. A transaction
rollback can leave already-applied cache effects; use bounded TTLs where this matters.

## Failure and backend model

The runtime only assumes cache-manager `get`, `set`, and `del` behavior. It cannot normalize store
serialization, connection management, retries, or real-store expiry timing. Applications configure
those operational concerns and must observe cache failures even though the library continues serving
provider results.

The backend contract covers the default memory configuration and one documented Redis configuration:
Keyv 5.6.0 with `@keyv/redis` 5.1.6 and Redis `8.10.1-alpine`. It verifies cache-aside behavior,
TTL, null and falsy values, exact invalidation, write-through, and fail-open handling. It does not
certify every Keyv adapter, Redis cluster, sentinel, TLS, or administration feature.

## Testing and packaging

Unit and integration tests protect policy, key, proxy, NestJS composition, and public testing
contracts. Memory and Redis tests share one behavioral backend contract. Redis tests use isolated
ephemeral infrastructure locally and in CI.

The package builds ESM, CommonJS, declarations, and source maps from explicit root and testing entry
points. The package `exports` map allowlists only those entry points and `package.json`. A release
check packs the artifact, verifies its allowlisted contents, audits declarations and private export
paths, and installs it into isolated ESM/CommonJS/TypeScript consumers.

## Invariants

- Public provider contracts do not depend on cache-manager or proxy implementation types.
- Cache configuration remains application-owned.
- Cache keys are deterministic, versioned, and never include raw sensitive input in validation messages.
- Provider execution precedes mutation cache effects.
- Cache-operation failures do not replace provider outcomes.
- Only explicit public exports are usable by package consumers.
