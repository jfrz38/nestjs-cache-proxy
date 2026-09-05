# NestJS Cache Proxy

## Overview

`nestjs-cache-proxy` is a NestJS library that provides transparent, declarative caching for providers.

The main goal is to add caching to repositories, services, or any other NestJS provider without modifying their implementation.

Caching must be configured exclusively at the NestJS dependency-injection / module level.

Application and infrastructure classes must remain unaware that caching exists.

The library should use NestJS dependency injection to wrap an existing provider with a transparent caching proxy.

Conceptually:

```text
Application
    │
    ▼
Repository interface / injection token
    │
    ▼
Caching Proxy
    │
    ├── CacheManager / Keyv
    │       │
    │       ├── Memory
    │       ├── Redis
    │       └── Other KV backends
    │
    ▼
Concrete Repository
    │
    ▼
Database
```

The application continues injecting the same repository interface or token.

Example:

```ts
constructor(
  private readonly organizations: ListOrganizationsRepository,
) {}
```

The consumer must not know whether the repository is cached.

---

# Goals

The library should provide:

* transparent caching through NestJS DI
* no cache-specific code inside repositories or services
* declarative cache policies
* strongly typed configuration
* cache-aside reads
* invalidation
* write-through
* explicit cache resources
* deterministic cache keys
* resource versioning
* cache contract testing
* backend abstraction
* memory and distributed cache support
* resilient behavior when cache backends fail
* observability
* testability
* refactor safety

The library should focus on **provider caching**, not HTTP caching.

HTTP features such as:

* `Cache-Control`
* ETags
* CDN caching
* conditional requests

are explicitly outside the scope of this project.

---

# Core principle

Given an existing NestJS provider:

```ts
{
  provide: ListOrganizationsRepository,
  useClass: OrganizationsPostgreRepository,
}
```

the library should allow replacing it with something conceptually similar to:

```ts
cachedProvider({
  provide: ListOrganizationsRepository,
  useClass: OrganizationsPostgreRepository,

  resources: {
    // ...
  },

  methods: {
    // ...
  },
});
```

Internally, NestJS should inject a Proxy instead of the raw repository.

The proxy intercepts configured method calls and applies the corresponding cache policy before or after delegating to the real implementation.

The concrete repository must not contain:

* cache decorators
* Redis dependencies
* cache-manager dependencies
* cache keys
* TTL configuration
* invalidation logic
* serialization configuration
* cache-specific branches
* cache-specific error handling

Example:

```ts
@Injectable()
export class OrganizationsPostgreRepository
  implements ListOrganizationsRepository {

  async findById(id: string): Promise<Organization | null> {
    // PostgreSQL
  }

  async findAll(): Promise<Organization[]> {
    // PostgreSQL
  }

  async update(
    id: string,
    organization: Organization,
  ): Promise<Organization> {
    // PostgreSQL
  }

  async delete(id: string): Promise<void> {
    // PostgreSQL
  }
}
```

This implementation should remain completely unchanged.

---

# Architectural responsibility split

```text
nestjs-cache-proxy
├── provider wrapping
├── DI integration
├── cache policies
├── cache-aside
├── invalidation
├── write-through
├── key contracts
├── resource versioning
├── serialization hooks
├── testing utilities
├── observability
├── consistency rules
└── resilience behavior

cache-manager / Keyv
├── storage abstraction
├── in-memory storage
├── Redis adapters
├── remote KV adapters
└── backend-specific storage behavior
```

The project must avoid becoming another cache storage framework.

Its value is the transparent integration of caching into the NestJS dependency-injection layer.

---

# Initial API proposal

Example configuration:

```ts
cachedProvider({
  provide: OrganizationRepository,
  useClass: OrganizationsPostgreRepository,

  resources: {
    organization: {
      version: 1,
      ttl: '5m',
      key: ([id]) => `${id}`,
    },

    organizations: {
      version: 1,
      ttl: '1m',
      key: () => 'all',
    },
  },

  methods: {
    findById: {
      cache: 'organization',
    },

    findAll: {
      cache: 'organizations',
    },

    update: {
      writeThrough: 'organization',
      invalidate: ['organizations'],
    },

    create: {
      invalidate: ['organizations'],
    },

    delete: {
      invalidate: ['organization', 'organizations'],
    },
  },
});
```

The exact public API may evolve.

Prefer a strongly typed and ergonomic API over preserving this exact syntax.

---

# Cache resources

A cache resource represents a cached representation of some data.

Example:

```ts
resources: {
  organization: {
    version: 1,
    ttl: '5m',
    key: ([id]) => `${id}`,
  },
}
```

A resource should define, at minimum:

* key generation
* TTL
* version

Potential future options:

* namespace
* serialization
* deserialization
* negative caching
* TTL jitter
* cache tier
* stale TTL
* coalescing
* tags

Resources should be reusable by multiple repository methods.

This avoids duplicating cache semantics between reads, updates and deletes.

---

# Cache-aside reads

A method configured with:

```ts
findById: {
  cache: 'organization',
}
```

should behave as:

```text
findById(id)
    │
    ▼
cache.get(key)
    │
    ├── HIT ─────────────► return cached value
    │
    └── MISS
          │
          ▼
    repository.findById(id)
          │
          ▼
    cache.set(key, result)
          │
          ▼
        return
```

The repository method should only execute on a cache miss.

This is the default read strategy.

---

# Write-through

If a mutation returns the new canonical value:

```ts
update: {
  writeThrough: 'organization',
}
```

the library should:

```text
repository.update(id, data)
        │
        ▼
   updated entity
        │
        ▼
cache.set(organization:id, entity)
        │
        ▼
      return
```

Do not execute an additional `findById()` when the mutation already returns the final entity.

The API may need explicit mappings:

```ts
update: {
  writeThrough: {
    resource: 'organization',

    keyArgs: ({ args }) => [args[0]],

    value: ({ result }) => result,
  },
}
```

The configuration must be strongly typed against the actual repository method.

---

# Invalidation

Mutating operations should be able to invalidate one or more resources.

Example:

```ts
delete: {
  invalidate: [
    'organization',
    'organizations',
  ],
}
```

Conceptually:

```text
repository.delete(id)
       │
       ▼
delete organization:id
       │
       ▼
delete organizations
```

The database operation must happen first.

Cache invalidation must only occur after a successful repository operation.

If the repository throws, the cache must not be invalidated.

---

# Cache refresh

The library may support explicit refresh operations:

```ts
update: {
  refresh: {
    method: 'findById',
    args: ({ args }) => [args[0]],
  },
}
```

This would execute a reader after a successful mutation and repopulate the corresponding cache entry.

Refresh should not be the default strategy.

Preferred order:

1. write-through when mutation result contains the canonical entity
2. invalidation when it does not
3. explicit refresh only when necessary

---

# Collections and derived queries

The library must distinguish individual entities from cached query results.

Examples:

```text
organization:v1:42
organizations:v1:all
organizations:v1:page:1
organizations:v1:active
organizations:v1:tenant:7
```

Updating organization `42` may invalidate:

```text
organization:v1:42
organizations:v1:all
organizations:v1:active
organizations:v1:tenant:7
```

This is substantially more complex than caching individual entities.

The first version does not need automatic dependency graphs, but the architecture must not prevent adding them later.

---

# Cache tags

A future feature may allow tagging cached values.

Example:

```ts
resources: {
  organizationById: {
    tags: ({ result }) => [
      'organizations',
      `organization:${result.id}`,
    ],
  },
}
```

Mutations could invalidate tags:

```ts
update: {
  invalidateTags: ({ args }) => [
    'organizations',
    `organization:${args[0]}`,
  ],
}
```

Tags may eventually be preferable to manually enumerating every derived cache resource.

This is not required for the MVP.

---

# Cache key contracts

Cache keys must be treated as persistent contracts.

A cache key is not merely an implementation detail.

Cached values may survive:

* application restarts
* deployments
* rolling deployments
* multiple versions running simultaneously
* repository refactors
* method signature changes
* changes to query semantics
* serialization changes

Therefore cache keys must be:

* deterministic
* strongly typed
* versioned
* testable

Example:

```ts
findById(id: string)
```

with:

```ts
key: ([id]) => `${id}`
```

may later become:

```ts
findById(
  tenantId: string,
  id: string,
)
```

If configuration is poorly typed, a stale key function could silently use the wrong parameter.

The library should make this difficult.

---

# Strong typing against repository methods

Method names and arguments should be inferred directly from the provider type.

Conceptually:

```ts
type MethodArgs<T, K extends keyof T> =
  T[K] extends (...args: infer A) => unknown
    ? A
    : never;
```

For:

```ts
interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
}
```

the key function should receive:

```ts
(args: [string]) => string
```

If the method becomes:

```ts
findById(
  tenantId: string,
  id: string,
): Promise<Organization | null>;
```

the cache configuration should now receive:

```ts
(args: [string, string]) => string
```

Method names in configuration should also be constrained to actual callable properties.

This should fail:

```ts
methods: {
  findByID: {
    cache: 'organization',
  },
}
```

if the actual method is:

```ts
findById()
```

---

# Parameter refactor safety

Positional parameters are more fragile than object arguments.

This:

```ts
findById(
  tenantId: string,
  id: string,
)
```

requires:

```ts
key: ([tenantId, id]) =>
  `${tenantId}:${id}`
```

A refactor that swaps two parameters of the same type may remain valid TypeScript.

For cache-sensitive queries, object arguments are safer:

```ts
findById(query: {
  tenantId: string;
  id: string;
})
```

Then:

```ts
key: ([query]) =>
  `${query.tenantId}:${query.id}`
```

Renaming or removing properties will produce stronger compile-time feedback.

The library should not require object parameters, but documentation should recommend them for complex cache keys.

---

# Resource versioning

Resources should support explicit versions:

```ts
resources: {
  organization: {
    version: 2,
    ttl: '5m',
    key: ([id]) => `${id}`,
  },
}
```

The final key should include the version automatically:

```text
organization:v2:123
```

Users should not manually encode versions in every key function.

A resource version should be bumped when there is an incompatible change in:

* cache key semantics
* argument interpretation
* serialized value shape
* repository return structure
* tenancy rules
* query meaning
* authorization-sensitive representation

Example:

```text
organization:v1:123
```

may contain:

```json
{
  "id": "123",
  "name": "Example"
}
```

while:

```text
organization:v2:123
```

may contain:

```json
{
  "id": "123",
  "name": "Example",
  "status": "ACTIVE"
}
```

Old values can naturally expire through TTL.

No explicit migration should usually be required.

---

# Namespaces

The library should generate namespaced final keys.

Potential format:

```text
<application>:<environment>:<resource>:v<version>:<key>
```

Example:

```text
my-api:production:organization:v2:123
```

This prevents collisions when:

* multiple applications share Redis
* multiple environments share infrastructure
* different modules use similar resource names

The exact prefix strategy should be configurable.

Example:

```ts
CacheProxyModule.forRoot({
  namespace: {
    application: 'my-api',
    environment: 'production',
  },
});
```

Repository cache policies should not need to repeat this information.

---

# Cache key collisions

Different inputs must not accidentally produce identical keys.

Bad:

```ts
key: ([tenantId, organizationId]) =>
  `${tenantId}${organizationId}`
```

This can produce:

```text
tenant=12, organization=3  -> 123
tenant=1, organization=23  -> 123
```

Prefer:

```ts
`${tenantId}:${organizationId}`
```

or another unambiguous representation.

Testing helpers should support collision tests for known input fixtures.

---

# Sensitive data in keys

Cache keys must not leak sensitive data.

Avoid directly including:

* passwords
* access tokens
* JWTs
* API keys
* secrets
* session IDs
* sensitive personal values

The library may eventually provide deterministic hashing helpers.

Example:

```ts
keyHash([userId, token])
```

However, key hashing should not be used as an excuse to make unstable key generation automatic.

---

# Multi-tenancy

Multi-tenant applications require special care.

This is unsafe:

```ts
key: ([id]) => `${id}`
```

if organizations are tenant-scoped.

Prefer:

```ts
key: ([tenantId, id]) =>
  `${tenantId}:${id}`
```

or:

```ts
key: ([query]) =>
  `${query.tenantId}:${query.id}`
```

Cross-tenant cache collisions may cause data leaks.

The documentation must explicitly call out tenant identity as part of the cache contract whenever cached data is tenant-specific.

---

# Serialization

Distributed caches typically do not preserve JavaScript object identity or prototypes.

Potential problematic values include:

* `Date`
* `BigInt`
* `Map`
* `Set`
* custom classes
* domain value objects
* Buffers
* cyclic structures

The library should not assume that every result can safely pass through `JSON.stringify()` / `JSON.parse()`.

Resources should eventually support:

```ts
organization: {
  serialize: (value) => ...,
  deserialize: (value) => ...,
}
```

The MVP may rely on the configured backend behavior but must document serialization expectations clearly.

Changing serialization format should normally require a resource version bump.

---

# Null and negative caching

The library must distinguish:

```text
cache MISS
```

from:

```text
cached null
```

Example:

```ts
findById('missing-id')
```

returns:

```ts
null
```

Repeated requests should optionally avoid repeatedly querying the database.

Resources may support:

```ts
organization: {
  cacheNull: true,
  negativeTtl: '30s',
}
```

This creates negative caching.

The cache abstraction must therefore use a reliable representation for cache misses.

Do not treat every `undefined` / `null` result as a cache miss without an explicit policy.

---

# TTL

Resources should define TTL explicitly.

Example:

```ts
organization: {
  ttl: '5m',
}
```

The library should normalize supported formats internally.

Potential inputs:

```ts
ttl: 300_000
```

or:

```ts
ttl: '5m'
```

The exact public API should remain simple and predictable.

---

# TTL jitter

A future feature should support TTL jitter.

Without jitter, thousands of entries created at approximately the same time may expire simultaneously.

Example:

```ts
organization: {
  ttl: '5m',
  jitter: 0.1,
}
```

Meaning approximately:

```text
5 minutes ± 10%
```

This helps prevent synchronized cache expiry and database spikes.

Not required for MVP.

---

# Cache stampede protection

Multiple simultaneous misses for the same key can overwhelm the database.

Without protection:

```text
100 simultaneous requests
        │
        ▼
   same cache miss
        │
        ▼
100 database queries
```

With request coalescing / single-flight:

```text
100 requests
      │
      ▼
 single cache miss
      │
      ▼
 one database query
      │
      ▼
 shared Promise
```

Potential configuration:

```ts
organization: {
  coalesce: true,
}
```

This should be considered an important post-MVP feature.

The implementation should operate per final cache key.

---

# Store abstraction

`nestjs-cache-proxy` must be cache-backend agnostic.

The library must not implement Redis, memory caches, or remote KV storage directly.

It should integrate with:

* `@nestjs/cache-manager`
* `cache-manager`
* Keyv-compatible stores/adapters

Conceptually:

```text
Provider Proxy
     │
     ▼
nestjs-cache-proxy
     │
     ▼
cache-manager / Keyv
     │
     ├── Memory
     ├── Redis
     ├── Remote KV
     └── Other compatible stores
```

Repository configuration must remain identical regardless of backend.

---

# Backend configuration

Backend configuration should remain separate from provider policy.

Preferred architecture:

```ts
@Module({
  imports: [
    CacheModule.register({
      // memory / Redis / Keyv configuration
    }),

    CacheProxyModule.forRoot(),
  ],
})
export class AppModule {}
```

`nestjs-cache-proxy` should consume the injected `CACHE_MANAGER`.

Avoid creating a competing cache storage abstraction unless necessary.

---

# Local in-memory cache

The library must work with local in-memory caches.

Topology:

```text
Application process
      │
      ▼
Memory cache
      │
      ▼
Repository
      │
      ▼
Database
```

Useful for:

* development
* tests
* single-instance services
* hot short-lived data

The documentation must state clearly that local memory is process-local.

---

# Distributed cache

The library must support shared distributed caches such as Redis through the configured cache ecosystem.

Topology:

```text
App instance A ─┐
                │
App instance B ─┼──► Redis ───► Database
                │
App instance C ─┘
```

This allows application instances to share cached values and invalidations at the distributed-store level.

---

# Remote KV stores

The architecture should allow remote key-value stores through compatible adapters.

Possible categories include:

* Redis-compatible services
* Keyv-supported stores
* custom Keyv adapters
* cloud KV systems

`nestjs-cache-proxy` should not depend directly on vendor-specific APIs.

---

# Multi-level caching

The architecture should allow L1/L2 cache topologies.

Example:

```text
Repository Proxy
      │
      ▼
L1 local memory
      │ miss
      ▼
L2 Redis / remote KV
      │ miss
      ▼
Database
```

Behavior:

```text
GET
 │
 ▼
L1
 ├── HIT -> return
 │
 └── MISS
      │
      ▼
     L2
      ├── HIT -> populate L1 -> return
      │
      └── MISS
           │
           ▼
       repository
           │
           ▼
       populate L2
           │
           ▼
       populate L1
           │
           ▼
         return
```

If `cache-manager` already supports multiple stores, prefer leveraging that capability rather than implementing the hierarchy from scratch.

---

# Multi-level cache consistency

L1/L2 caching introduces consistency problems.

Example:

```text
App A L1
App B L1
App C L1
   │
   └── shared Redis L2
```

Deleting a value from Redis does not necessarily remove it from every process-local L1 cache.

Therefore the library must not claim strong consistency unless an invalidation propagation mechanism exists.

Potential future strategies:

* short L1 TTL
* Redis Pub/Sub
* event bus
* invalidation messages
* resource generations
* versioned entries

For the MVP, consistency limitations must be documented clearly.

---

# Store selection per resource

The initial version should use the globally configured cache manager.

Do not require users to select a backend for each resource.

Potential future API:

```ts
resources: {
  organization: {
    tier: 'distributed',
  },

  countryList: {
    tier: 'local',
  },
}
```

or:

```ts
CacheProxyModule.forRoot({
  stores: {
    local: ...,
    distributed: ...,
  },
});
```

This is not required initially, but the architecture should not prevent it.

---

# Dependency injection

The feature should integrate using standard NestJS custom-provider mechanisms.

Internally:

```ts
{
  provide: RepositoryToken,

  inject: [
    ConcreteRepository,
    CACHE_MANAGER,
  ],

  useFactory: (
    repository,
    cache,
  ) => createCachingProxy(
    repository,
    cache,
    policy,
  ),
}
```

The concrete provider must also be registered separately so the proxy factory can inject it.

Avoid modifying NestJS internals.

---

# Proxy implementation

Use JavaScript `Proxy` to intercept configured method calls.

Conceptually:

```ts
new Proxy(repository, {
  get(target, property, receiver) {
    const value = Reflect.get(
      target,
      property,
      receiver,
    );

    if (typeof value !== 'function') {
      return value;
    }

    return (...args: unknown[]) =>
      executePolicy({
        target,
        method: property,
        args,
        value,
      });
  },
});
```

Requirements:

* preserve `this`
* preserve arguments
* preserve return values
* preserve async behavior
* transparently forward unconfigured methods
* preserve repository errors
* preserve property access
* avoid modifying behavior when caching is disabled

---

# Default behavior

Caching must be explicit.

Do not automatically cache every public method.

Example:

```ts
methods: {
  findById: {
    cache: 'organization',
  },
}
```

means:

```text
findById() -> cached
save()     -> passthrough
update()   -> passthrough
delete()   -> passthrough
```

Do not infer behavior from method names such as:

```text
get*
find*
save*
update*
delete*
```

Explicit configuration is safer.

---

# Error handling

The underlying database remains the source of truth.

Default behavior should favor availability.

Example:

```text
cache GET fails
      │
      ▼
execute repository
```

```text
repository succeeds
      │
      ▼
cache SET fails
      │
      ▼
return repository result
```

Repository failures must never be swallowed.

The library should eventually allow configuring fail-open vs fail-closed behavior.

Default recommendation:

```text
cache failures -> fail open
repository failures -> propagate
```

---

# Cache timeouts

A slow cache can be worse than a failed cache.

Example:

```text
Redis GET = 2 seconds
Database query = 20 ms
```

The cache layer should eventually support configurable operation timeouts.

Example:

```ts
CacheProxyModule.forRoot({
  timeout: {
    get: '50ms',
    set: '100ms',
  },
});
```

If cache access exceeds the configured threshold, the library may fail open and execute the repository.

Not required for MVP, but the design should account for it.

---

# Circuit breaker

A future version may support circuit-breaker behavior around cache backends.

If Redis repeatedly fails, repeatedly attempting every cache operation may increase latency.

Potential behavior:

```text
Redis healthy
   │
   ▼
normal caching

many Redis failures
   │
   ▼
circuit open
   │
   ▼
temporarily bypass cache
```

Not required for MVP.

---

# Order of effects

Mutation ordering must be deterministic.

Preferred order:

```text
repository mutation
        │
        ▼
successful DB result
        │
        ▼
cache update / invalidation
        │
        ▼
return
```

Do not mutate cache before the source-of-truth operation succeeds.

---

# Transactions

Caching introduces complexity around database transactions.

This is unsafe:

```text
UPDATE DB inside transaction
        │
        ▼
cache invalidated
        │
        ▼
transaction rolls back
```

The database still contains the old value, but cache state was modified based on an uncommitted mutation.

The library must document that caching at provider-call level cannot automatically understand arbitrary application transaction boundaries.

Potential future strategies:

* post-commit hooks
* transactional context integration
* explicit transaction-aware cache operations
* event-based invalidation after commit

For the initial version, avoid claiming transaction-awareness.

This limitation must be clearly documented.

---

# Async invalidation

The library may eventually support asynchronous invalidation:

```text
UPDATE PostgreSQL
      │
      ▼
return response
      │
      └── asynchronously invalidate cache
```

This reduces request latency but introduces an inconsistency window.

Default behavior should remain synchronous and correctness-oriented.

Async invalidation should always be explicit.

---

# Write-behind

Do not implement write-behind caching in the initial versions.

The cache must never become the source of truth for repository mutations.

Database writes should always occur before cache effects.

---

# Source of truth

The database / underlying repository remains canonical.

The cache stores materialized query results.

Think:

```text
cached query representation
```

not:

```text
secondary repository
```

Redis must not become an authoritative datastore through this library.

---

# Bulk methods

Methods such as:

```ts
findByIds(ids: string[])
```

introduce design choices.

Two common strategies:

### Query-level caching

```text
users:v1:1,2,3
```

### Entity-level caching

```text
user:v1:1
user:v1:2
user:v1:3
```

Entity-level caching enables partial hits but is significantly more complex.

The first version should not automatically decompose bulk queries.

Users should explicitly configure bulk-query resources.

Future versions may introduce advanced helpers.

---

# Pagination and filters

Queries such as:

```ts
findAll({
  page,
  size,
  sort,
  status,
  tenant,
})
```

may create large numbers of cache keys.

The library should not attempt to automatically optimize these.

Configuration should remain explicit.

Future tags or dependency graphs may help invalidate derived query caches.

---

# Observability

Caching must be observable.

The library should expose structured events or hooks for:

```text
cache.hit
cache.miss
cache.get_error
cache.set
cache.set_error
cache.invalidate
cache.invalidate_error
cache.write_through
cache.coalesced
cache.bypass
```

Useful dimensions:

* provider
* method
* resource
* backend
* latency
* cache result

Avoid emitting full cache keys by default.

Keys may contain business identifiers or sensitive information.

---

# OpenTelemetry

Future versions should consider OpenTelemetry integration.

Potential spans:

```text
cache.get
cache.set
cache.invalidate
repository.execute
```

Attributes:

```text
cache.resource
cache.operation
cache.hit
cache.backend
```

Do not include raw values or full keys by default.

---

# Metrics

Potential metrics:

```text
cache_requests_total
cache_hits_total
cache_misses_total
cache_errors_total
cache_invalidations_total
cache_coalesced_requests_total
cache_operation_duration
repository_fallback_total
```

Useful derived metric:

```text
hit ratio = hits / (hits + misses)
```

Metrics should integrate cleanly with existing observability systems rather than requiring a proprietary backend.

---

# Debugging

A debug mode may provide structured diagnostics.

Example:

```ts
CacheProxyModule.forRoot({
  debug: true,
});
```

Possible output:

```text
OrganizationRepository.findById
resource=organization
version=2
cache=MISS
repository=EXECUTED
ttl=300s
```

Do not log full keys or cached values by default.

---

# Cache bypass

There should eventually be a way to intentionally bypass cache without modifying the repository.

Potential use cases:

* administration
* diagnostics
* retry flows
* tests
* forced refresh
* backfills

Possible future mechanism:

```ts
await cacheContext.run(
  { bypass: true },
  () => repository.findById(id),
);
```

Avoid adding cache-specific arguments to repository methods.

---

# Testing philosophy

Repository tests should remain independent from caching.

Example:

```ts
describe('OrganizationsPostgreRepository', () => {
  // PostgreSQL behavior only
});
```

Caching should be tested separately against:

* cache configuration
* proxy behavior
* cache contracts

The library should provide dedicated testing utilities.

---

# Deterministic in-memory test backend

The library should provide or recommend a deterministic in-memory test cache.

Tests should not require Redis unless specifically testing Redis integration.

Useful testing features:

* explicit clear/reset
* deterministic TTL
* inspectable keys
* inspectable values
* fake clock compatibility

---

# Fake clock

TTL tests should not require real waiting.

Potential helper:

```ts
const clock = createCacheTestClock();

clock.advance('5m');
```

The exact implementation is flexible.

A fake-clock-friendly design is preferred.

---

# Cache behavior tests

The library should make it easy to verify:

* cache hit does not execute repository
* cache miss executes repository
* cache miss stores the result
* TTL is applied
* correct key is generated
* null values are handled correctly
* unconfigured methods pass through
* repository errors propagate
* cache failures follow fallback behavior
* failed mutations do not invalidate cache
* write-through stores the returned value
* invalidation removes the correct resource

Potential API:

```ts
expectCache(provider)
  .method('findById')
  .withArgs('123')
  .toUseKey('organization:v1:123');
```

Exact syntax is not fixed.

---

# Cache contract tests

The library should support explicit cache contract tests.

Example:

```ts
cacheContract({
  provider: OrganizationRepository,
  config: organizationCacheConfig,

  cases: {
    findById: [
      {
        args: ['123'],
        expectedKey:
          'organization:v1:123',
      },
    ],
  },
});
```

Alternative:

```ts
expectCacheKey(config)
  .for('findById')
  .withArgs('123')
  .toBe('organization:v1:123');
```

The goal is to make cache key changes intentional.

---

# Method signature changes

Consider:

```ts
findById(id: string)
```

becoming:

```ts
findById(
  tenantId: string,
  id: string,
)
```

Protection should exist at several layers.

## Compile-time

Cache configuration should be typed against the current method signature.

## Test-time

Existing contract tests should fail when key behavior changes.

## Runtime/deployment

Breaking semantic changes should use a resource version bump.

Example:

```ts
version: 1
```

becomes:

```ts
version: 2
```

---

# Cache contract snapshots

A future CLI may store cache contracts.

Example:

```text
.cache-contract.json
```

```json
{
  "OrganizationRepository.findById": {
    "resource": "organization",
    "version": 1,
    "exampleKey": "organization:v1:123"
  }
}
```

Potential command:

```bash
nestjs-cache-proxy check
```

Example output:

```text
BREAKING CACHE CONTRACT

OrganizationRepository.findById

Previous:
organization:v1:123

Current:
organization:v1:tenant-a:123

Consider bumping:

organization.version: 1 -> 2
```

This is not required for MVP.

---

# CI integration

Future CI validation may detect:

* unknown methods
* removed configured methods
* unknown resources
* invalid invalidation targets
* changed keys
* stale cache contracts
* missing version bumps
* collisions in declared fixtures

Potential command:

```bash
nestjs-cache-proxy check
```

Cache contract changes should be visible during code review.

---

# Invalid configuration

Configuration errors should fail early.

Examples:

* configured method does not exist
* configured property is not callable
* resource does not exist
* write-through targets unknown resource
* invalidation targets unknown resource
* invalid TTL
* invalid version
* duplicate unsafe namespace/version combinations

Compile-time checks should catch as much as possible.

Runtime validation should cover what TypeScript cannot guarantee.

---

# Security considerations

Caching can accidentally broaden data visibility.

The library documentation must highlight:

* multi-tenant isolation
* user-specific queries
* permission-dependent queries
* authorization-sensitive results
* sensitive values in keys
* sensitive values in logs
* shared cache risks

Example:

```ts
findProfile(userId)
```

must not produce a key that accidentally ignores authorization scope if returned data differs by caller.

Cache policy must model all input dimensions that materially affect the returned result.

---

# Authorization-sensitive caching

If:

```ts
findDocument(documentId, currentUser)
```

returns different representations depending on permissions, then:

```text
document:<documentId>
```

is unsafe.

The relevant authorization context must either:

* be part of the key
* produce a user-scoped resource
* disable caching

The library should not attempt to automatically infer this.

---

# Cache failures and consistency

Cache operations should never silently alter source-of-truth semantics.

Default behavior:

```text
cache failure
   │
   ▼
fallback to repository
```

The application should generally remain functional if Redis is unavailable.

However, stale cache consistency cannot always be solved by fail-open behavior.

Documentation must distinguish:

* availability
* consistency
* freshness

---

# Rolling deployments

Multiple application versions may run simultaneously.

Example:

```text
App v1
App v1
App v2
App v2
```

Resource versioning helps isolate incompatible values.

Example:

```text
organization:v1:123
organization:v2:123
```

This should be treated as a first-class design consideration.

---

# Reusable policies

The library should eventually support reusable cache configuration.

Example:

```ts
const entityCache =
  defineCacheResource({
    ttl: '5m',
    version: 1,
  });
```

Usage:

```ts
organization: entityCache({
  key: ([id]) => `${id}`,
})
```

This reduces duplication across repositories.

Other possible reusable policies:

```ts
shortLivedEntityCache
longLivedReferenceCache
tenantScopedEntityCache
```

---

# Configuration location

Cache behavior should be visible from the composition root.

Preferred:

```ts
@Module({
  providers: [
    cachedProvider({
      // complete cache policy
    }),
  ],
})
```

Acceptable alternative:

```ts
const organizationCache =
  defineCachePolicy<OrganizationRepository>({
    // ...
  });
```

then:

```ts
cachedProvider({
  provide: OrganizationRepository,
  useClass: PostgreOrganizationRepository,
  policy: organizationCache,
});
```

Both keep caching outside the repository implementation.

---

# Separate policy files

Large applications should be able to keep cache configuration outside Nest modules.

Example:

```text
organizations/
├── organization.repository.ts
├── organization.repository.postgres.ts
├── organization.cache-policy.ts
└── organization.module.ts
```

Example:

```ts
export const organizationCachePolicy =
  defineCachePolicy<OrganizationRepository>({
    resources: {
      // ...
    },

    methods: {
      // ...
    },
  });
```

Then:

```ts
cachedProvider({
  provide: OrganizationRepository,
  useClass: PostgreOrganizationRepository,
  policy: organizationCachePolicy,
});
```

This keeps modules readable without contaminating repository code.

---

# Example final developer experience

```ts
export const organizationCachePolicy =
  defineCachePolicy<OrganizationRepository>({
    resources: {
      organization: {
        version: 1,
        ttl: '5m',
        key: ([id]) => `${id}`,
      },

      organizations: {
        version: 1,
        ttl: '1m',
        key: () => 'all',
      },
    },

    methods: {
      findById: {
        cache: 'organization',
      },

      findAll: {
        cache: 'organizations',
      },

      update: {
        writeThrough: {
          resource: 'organization',
          keyArgs: ({ args }) => [
            args[0],
          ],
          value: ({ result }) => result,
        },

        invalidate: [
          'organizations',
        ],
      },

      create: {
        invalidate: [
          'organizations',
        ],
      },

      delete: {
        invalidate: [
          'organization',
          'organizations',
        ],
      },
    },
  });
```

Nest module:

```ts
@Module({
  imports: [
    CacheModule.register({
      // configured backend
    }),
  ],

  providers: [
    cachedProvider({
      provide: OrganizationRepository,
      useClass: PostgreOrganizationRepository,
      policy: organizationCachePolicy,
    }),
  ],
})
export class OrganizationModule {}
```

Business code:

```ts
@Injectable()
export class GetOrganization {
  constructor(
    private readonly repository:
      OrganizationRepository,
  ) {}

  execute(id: string) {
    return this.repository.findById(id);
  }
}
```

Repository implementation:

```ts
@Injectable()
export class PostgreOrganizationRepository
  implements OrganizationRepository {

  findById(id: string) {
    return this.database.organization.findUnique({
      where: { id },
    });
  }

  findAll() {
    return this.database.organization.findMany();
  }

  update(
    id: string,
    data: Organization,
  ) {
    return this.database.organization.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return this.database.organization.delete({
      where: { id },
    });
  }
}
```

Neither the business code nor the repository implementation knows that caching exists.

---

# Example refactor scenario

Initial repository:

```ts
interface OrganizationRepository {
  findById(
    id: string,
  ): Promise<Organization | null>;
}
```

Configuration:

```ts
organization: {
  version: 1,
  key: ([id]) => `${id}`,
}
```

Generated key:

```text
organization:v1:123
```

Later:

```ts
interface OrganizationRepository {
  findById(
    tenantId: string,
    id: string,
  ): Promise<Organization | null>;
}
```

New policy:

```ts
organization: {
  version: 2,

  key: ([tenantId, id]) =>
    `${tenantId}:${id}`,
}
```

Generated key:

```text
organization:v2:tenant-a:123
```

Expected protections:

1. TypeScript makes the signature change visible.
2. Cache contract tests detect the changed key.
3. Developer intentionally increments the resource version.
4. Old and new deployment versions do not reuse incompatible cache entries.

---

# MVP scope

The first usable version should support:

1. NestJS custom provider integration
2. transparent provider proxy
3. strongly typed method configuration
4. explicit cache resources
5. cache-aside reads
6. deterministic keys
7. resource namespaces
8. resource versioning
9. TTL
10. invalidation
11. write-through
12. passthrough for unconfigured methods
13. `CACHE_MANAGER` integration
14. local memory cache compatibility
15. Redis/Keyv compatibility
16. fail-open cache behavior
17. null/miss distinction
18. basic serialization expectations
19. unit-test helpers
20. cache key contract tests
21. invalid configuration validation

---

# MVP+1

High-value next features:

* negative caching
* request coalescing / single-flight
* TTL jitter
* metrics
* OpenTelemetry
* reusable policies
* explicit bypass context
* configurable timeouts
* improved serialization hooks

---

# Future scope

Potential future features:

* cache tags
* cache dependency graphs
* multi-level L1/L2 policies
* distributed L1 invalidation
* Redis Pub/Sub
* event-driven invalidation
* async invalidation
* stale-while-revalidate
* circuit breaker
* named cache tiers
* store selection per resource
* cache contract snapshots
* CLI validation
* CI checks
* key collision fixtures
* resource-generation invalidation
* transaction integration
* ORM-specific helpers
* bulk entity caching
* configurable consistency models

---

# Explicitly out of scope

Do not initially implement:

* HTTP caching
* `Cache-Control`
* ETags
* CDN integration
* database replication
* write-behind
* automatic read/write detection based on method names
* decorators on repositories
* source-code generation
* Redis-specific APIs
* automatic ORM query parsing
* automatic transaction interception
* automatic cache-key migration

---

# Design constraints

Prioritize:

* transparency
* type safety
* minimal boilerplate
* dependency inversion
* explicit configuration
* compatibility with NestJS DI
* backend independence
* predictable behavior
* testability
* refactor safety
* deterministic cache contracts
* observability
* correctness

Avoid:

* hidden magic
* implicit method classification
* repository decorators
* backend-specific policy configuration
* duplicated cache key definitions
* unsafe serialization assumptions
* silently swallowed repository errors

---

# Core invariants

The implementation should preserve these invariants:

### 1. The repository is the source of truth

Cache state must never replace repository persistence.

### 2. The repository implementation is cache-agnostic

No cache-specific code belongs inside the concrete implementation.

### 3. The consumer is cache-agnostic

Injected provider semantics remain unchanged.

### 4. Unconfigured methods are transparent

They execute exactly as the underlying provider would.

### 5. Repository failures propagate

Caching must never hide repository failures.

### 6. Cache failures should normally fail open

A cache outage should not normally make the repository unavailable.

### 7. Mutations happen before cache effects

Never update cache based on an unsuccessful source-of-truth operation.

### 8. Keys are contracts

Changes to key semantics must be explicit and testable.

### 9. Versions isolate incompatible representations

Breaking cache changes should use new resource versions.

### 10. Backend technology does not leak into resource policy

A repository policy should work with memory, Redis, or compatible stores without changing its semantics.

---

# Testing requirements

The project test suite must cover at minimum:

## Proxy behavior

* method arguments preserved
* return values preserved
* async methods preserved
* sync methods preserved
* `this` binding preserved
* property access preserved
* unconfigured methods pass through

## Reads

* cache hit returns cached value
* cache hit skips repository
* cache miss executes repository
* cache miss stores repository result
* TTL forwarded
* correct resource key used

## Null handling

* cached null is distinguishable from miss
* optional negative caching works correctly

## Invalidations

* correct key invalidated
* multiple resources invalidated
* invalidation happens after successful mutation
* failed mutation does not invalidate

## Write-through

* repository executes first
* returned canonical value written to cache
* correct cache key derived from mutation args
* no unnecessary extra read occurs

## Errors

* repository error propagates unchanged
* cache GET failure falls back
* cache SET failure does not discard repository result
* invalidation failure follows configured policy

## Contracts

* keys deterministic
* resource version included
* namespace included
* refactor fixtures generate expected keys
* collision fixtures do not collide
* invalid resources rejected
* unknown methods rejected

## Backend integration

* in-memory integration
* NestJS `CACHE_MANAGER`
* Redis-compatible integration test

## Security

* multi-tenant keys isolate tenants
* sensitive values are not unintentionally logged

---

# First implementation plan

Before implementing the full feature set:

## Phase 1 — API design

Define:

* `cachedProvider`
* `defineCachePolicy`
* resource types
* method configuration types
* key builders
* generic method inference

Focus heavily on TypeScript inference.

---

## Phase 2 — Minimal proxy

Implement:

```text
method
  ↓
cache GET
  ↓ miss
repository
  ↓
cache SET
```

Support one configured read method.

Add tests.

---

## Phase 3 — NestJS integration

Integrate with:

* custom providers
* `CACHE_MANAGER`
* concrete provider registration

Verify that consumers still receive the expected token.

---

## Phase 4 — Keys and contracts

Implement:

* resource names
* namespaces
* versions
* deterministic final keys
* testing helpers

---

## Phase 5 — Mutations

Implement:

* invalidation
* multiple invalidations
* write-through

---

## Phase 6 — Error handling

Implement:

* cache fail-open
* repository error propagation
* cache operation error hooks

---

## Phase 7 — Null handling and serialization

Implement:

* miss sentinel
* cached null
* serialization boundaries

---

## Phase 8 — Testing utilities

Provide helpers for:

* key generation
* cache behavior
* contract assertions
* deterministic in-memory testing

---

## Phase 9 — Integration tests

Test:

* NestJS module
* memory cache
* Redis-compatible store

---

## Phase 10 — Documentation

Document:

* architecture
* cache-aside
* invalidation
* write-through
* key contracts
* versioning
* multi-tenancy
* backend selection
* failure semantics
* transaction limitations
* testing

---

# Long-term project direction

The long-term value of `nestjs-cache-proxy` should come from combining:

```text
NestJS DI
    +
transparent provider proxies
    +
declarative cache policies
    +
strong TypeScript inference
    +
versioned cache contracts
    +
backend independence
    +
testing and observability
```

The project should remain focused.

It should not become a distributed datastore, HTTP cache framework, ORM abstraction, or Redis wrapper.

Its purpose is to make application-level caching in NestJS transparent, explicit, testable and difficult to misuse.
