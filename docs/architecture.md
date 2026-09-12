# NestJS Cache Proxy

## Overview

`nestjs-cache-proxy` is a NestJS library for transparent, declarative caching of NestJS providers.

The library allows caching to be introduced at the dependency-injection and module-composition level without modifying the implementation of the provider being cached.

A cached provider may be:

- a repository
- a use case
- an application service
- an API client
- a gateway
- an adapter
- a query handler
- another injectable NestJS provider

The provider implementation and its consumers must remain unaware that caching exists.

## MVP delivery baseline

This document describes both the initial product and its longer-term direction. The
authoritative, executable delivery sequence is the [iteration plan](iterations/README.md).
Where an exploratory example in this document is broader than that plan, the following
MVP constraints take precedence:

- only methods returning `Promise<T>` may declare cache behavior; synchronous methods,
  Observables, streams, async iterables, and callback APIs are not adapted
- wrapped providers are singleton-scoped and identified by runtime NestJS tokens
- `useClass` is the only implementation ownership model; `useExisting` is post-MVP
- invalidation deletes explicitly derived exact keys; resource-wide deletion is valid
  only for a resource whose key is constant
- TTL values are positive integer milliseconds at the library boundary
- an internal versioned value envelope distinguishes a miss from a cached `null`;
  `undefined` is never cached
- cache operation failures fail open and are reported through a minimal error hook,
  while provider failures always propagate
- key version changes isolate incompatible entries but neither migrate nor eagerly
  remove previous entries

These constraints preserve the plug-and-play goal: provider implementations and their
consumers remain unchanged. Explicit configuration is confined to module composition
and TypeScript policy declarations because key identity, tenant boundaries, TTL, and
mutation effects cannot be inferred safely.

Conceptually:

```text
Consumer
   │
   ▼
Provider token
   │
   ▼
Caching Proxy
   │
   ├── CacheManager / Keyv
   │       ├── Memory
   │       ├── Redis
   │       └── Other KV stores
   │
   ▼
Concrete provider
```

For a repository:

```text
Use Case
   │
   ▼
UserRepository
   │
   ▼
Caching Proxy
   │
   ├── Redis
   │
   ▼
SqlUserRepository
   │
   ▼
PostgreSQL
```

For a use case:

```text
Controller
   │
   ▼
UserByCriteriaSearcher
   │
   ▼
Caching Proxy
   │
   ▼
DefaultUserByCriteriaSearcher
   │
   ▼
UserRepository
```

The consumer continues injecting exactly the same token:

```ts
export class UserByCriteriaSearcher {
  constructor(private readonly repository: UserRepository) {}
}
```

The consumer must not know whether caching is enabled.

---

# Core idea: automate the Decorator pattern

Without this library, caching could be implemented manually using the Decorator pattern.

For example:

```ts
export class RedisCacheUserRepository implements UserRepository {
  constructor(
    private readonly repository: UserRepository,
    private readonly client: RedisClient,
  ) {}

  async save(user: User): Promise<void> {
    const result = await this.repository.save(user);

    // optionally invalidate affected cache entries

    return result;
  }

  async matching(criteria: Criteria): Promise<User> {
    const cached = await this.findInCache(criteria);

    if (cached !== undefined) {
      return cached;
    }

    const user = await this.repository.matching(criteria);

    await this.saveInCache(criteria, user);

    return user;
  }
}
```

This works, but introduces repetitive infrastructure code:

- one cache decorator class per provider
- duplicated cache lookup logic
- duplicated cache write logic
- duplicated invalidation logic
- Redis/cache dependencies in application infrastructure
- manual DI wiring

`nestjs-cache-proxy` should automate this pattern.

Instead of manually creating:

```text
RedisCacheUserRepository
```

the library creates an equivalent runtime proxy.

Conceptually:

```text
UserRepository
      │
      ▼
Generated runtime proxy
      │
      ├── cache policy
      ├── cache manager
      │
      ▼
SqlUserRepository
```

The library does not need to generate a physical TypeScript class.

It can use:

- NestJS factory providers
- JavaScript `Proxy`
- declarative cache policies

to obtain equivalent behavior.

---

# Core principle

Given:

```ts
{
  provide: UserRepository,
  useClass: SqlUserRepository,
}
```

the developer should be able to replace it with:

```ts
cachedProvider({
  provide: UserRepository,
  useClass: SqlUserRepository,
  policy: userCachePolicy,
});
```

The application still injects:

```ts
UserRepository;
```

but NestJS actually resolves:

```text
UserRepository token
        │
        ▼
Caching Proxy
        │
        ▼
SqlUserRepository
```

The concrete provider remains unchanged.

---

# Provider implementations must remain cache-agnostic

A provider being cached must not need:

- cache decorators
- Redis dependencies
- cache-manager dependencies
- cache keys
- TTL configuration
- invalidation logic
- serialization configuration
- cache branches
- cache-specific method parameters
- cache-specific error handling

Example:

```ts
@Injectable()
export class SqlUserRepository implements UserRepository {
  async save(user: User): Promise<void> {
    // SQL only
  }

  async matching(criteria: Criteria): Promise<User> {
    // SQL only
  }
}
```

No cache-specific code should be introduced.

---

# Provider consumers must remain cache-agnostic

Consumers should also remain unchanged.

Example:

```ts
@Injectable()
export class UserByCriteriaSearcher {
  constructor(private readonly repository: UserRepository) {}

  execute(criteria: Criteria) {
    return this.repository.matching(criteria);
  }
}
```

Enabling or disabling caching must not require changes here.

---

# Providers, not repositories

The public API should use provider terminology.

Prefer:

```ts
cachedProvider(...)
```

over:

```ts
cachedRepository(...)
```

Prefer:

```ts
defineCachePolicy<UserService>(...)
```

over repository-specific abstractions.

The library operates on NestJS providers.

Repository caching is simply one important use case.

---

# Goals

The library should provide:

- transparent caching through NestJS DI
- declarative cache configuration
- zero cache code inside wrapped providers
- strongly typed policies
- cache-aside
- invalidation
- write-through
- explicit resources
- deterministic cache keys
- cache resource versioning
- cache contracts
- testing utilities
- memory cache support
- Redis support through existing cache abstractions
- remote KV compatibility
- observability
- resilience
- refactor safety
- centralized cache configuration

---

# Architectural responsibility split

```text
nestjs-cache-proxy
├── NestJS provider wrapping
├── dependency injection integration
├── cache policy definitions
├── resource definitions
├── cache-aside
├── invalidation
├── write-through
├── key generation
├── cache contracts
├── versioning
├── testing utilities
├── observability
├── resilience
└── consistency rules

cache-manager / Keyv
├── cache storage abstraction
├── local memory
├── Redis adapters
├── remote KV adapters
└── backend-specific behavior
```

The library must not become another Redis or KV client.

Its value is the transparent caching layer around NestJS providers.

---

# Cache backend architecture

The library must be backend-agnostic.

It should build on the NestJS caching ecosystem:

- `@nestjs/cache-manager`
- `cache-manager`
- Keyv-compatible stores

Conceptually:

```text
Caching Proxy
     │
     ▼
CACHE_MANAGER
     │
     ▼
cache-manager / Keyv
     │
     ├── Memory
     ├── Redis
     ├── Remote KV
     └── Other adapters
```

Cache policies should describe caching semantics, not backend technology.

Good:

```ts
organization: {
  version: 1,
  ttl: 300_000,
  key: ([id]) => id,
}
```

Avoid:

```ts
organization: {
  redisDb: 2,
  redisPrefix: 'org',
}
```

---

# Global module configuration

Global cache infrastructure should be configured once.

The desired API should resemble established NestJS module patterns such as:

```text
TypeOrmModule.forRoot()
TypeOrmModule.forFeature()

MongooseModule.forRoot()
MongooseModule.forFeature()
```

`nestjs-cache-proxy` should therefore consider exposing:

```ts
CacheProxyModule.forRoot(...)
```

and:

```ts
CacheProxyModule.forFeature(...)
```

---

# `CacheProxyModule.forRoot`

`forRoot` should configure library-wide behavior.

Example:

```ts
@Module({
  imports: [
    CacheModule.register({
      // memory / Redis / Keyv
    }),

    CacheProxyModule.forRoot({
      namespace: {
        application: 'users-api',
        environment: process.env.NODE_ENV,
      },
    }),
  ],
})
export class AppModule {}
```

Possible global options:

- namespace
- error behavior
- logging/debugging
- observability hooks
- defaults
- cache operation timeout
- future coalescing defaults
- future serialization defaults

The actual storage backend should normally remain configured through NestJS `CacheModule`.

`CacheProxyModule` should consume `CACHE_MANAGER`.

---

# `CacheProxyModule.forFeature`

`forFeature` should register cached providers.

Example:

```ts
CacheProxyModule.forFeature([
  {
    provide: UserRepository,
    useClass: SqlUserRepository,
    policy: userCachePolicy,
  },

  {
    provide: OrganizationRepository,
    useClass: SqlOrganizationRepository,
    policy: organizationCachePolicy,
  },
]);
```

The dynamic module should:

1. register or resolve the concrete implementation
2. create the caching proxy
3. inject the cache manager
4. expose the original public provider token

Conceptually:

```text
SqlUserRepository
       │
       ▼
Proxy factory
       │
       ├── CACHE_MANAGER
       ├── policy
       │
       ▼
UserRepository token
```

---

# Centralized application cache module

Applications should be able to centralize all caching configuration in a dedicated module.

Example structure:

```text
src/
├── users/
│   ├── user.repository.ts
│   ├── sql-user.repository.ts
│   ├── user-by-criteria-searcher.ts
│   └── users.module.ts
│
├── organizations/
│   └── ...
│
└── cache/
    ├── application-cache.module.ts
    ├── user.cache-policy.ts
    └── organization.cache-policy.ts
```

Example:

```ts
@Module({
  imports: [
    CacheProxyModule.forFeature([
      {
        provide: UserRepository,
        useClass: SqlUserRepository,
        policy: userCachePolicy,
      },

      {
        provide: OrganizationRepository,
        useClass: SqlOrganizationRepository,
        policy: organizationCachePolicy,
      },
    ]),
  ],

  exports: [CacheProxyModule],
})
export class ApplicationCacheModule {}
```

Functional modules may then simply import:

```ts
@Module({
  imports: [ApplicationCacheModule],

  providers: [UserByCriteriaSearcher],
})
export class UsersModule {}
```

The use case remains:

```ts
@Injectable()
export class UserByCriteriaSearcher {
  constructor(private readonly repository: UserRepository) {}
}
```

No cache configuration is required in the use case.

---

# Concrete provider ownership

The proxy needs access to the real concrete implementation.

There are two valid architectural models.

## Model A — cache module registers the implementation

Example:

```ts
CacheProxyModule.forFeature([
  {
    provide: UserRepository,
    useClass: SqlUserRepository,
    policy: userCachePolicy,
  },
]);
```

Internally the dynamic module registers:

```text
SqlUserRepository
```

as well as:

```text
UserRepository -> caching proxy
```

This is the simplest developer experience.

---

# Model B — cache module wraps an existing provider (post-MVP)

Infrastructure modules may own the concrete provider.

Example:

```ts
@Module({
  providers: [SqlUserRepository],

  exports: [SqlUserRepository],
})
export class UserInfrastructureModule {}
```

Then:

```ts
@Module({
  imports: [
    UserInfrastructureModule,

    CacheProxyModule.forFeature([
      {
        provide: UserRepository,
        useExisting: SqlUserRepository,
        policy: userCachePolicy,
      },
    ]),
  ],
})
export class UserCacheModule {}
```

Conceptually:

```text
UserInfrastructureModule
        │
        ▼
SqlUserRepository
        │
        ▼
UserCacheModule
        │
        ▼
Caching Proxy
        │
        ▼
UserRepository
```

The library should eventually support both `useClass` and `useExisting`. The MVP supports
only `useClass`. `useExisting` requires a separate design pass covering module visibility,
exports, scopes, duplicate public tokens, and dependency cycles.

---

# Recommended application architecture

A clean architecture may use:

```text
Infrastructure Module
        │
        │ exports concrete providers
        ▼
Application Cache Module
        │
        │ wraps providers
        ▼
Functional Modules
        │
        ▼
Use Cases / Controllers
```

Example:

```text
UserInfrastructureModule
       │
       ▼
ApplicationCacheModule
       │
       ▼
UsersModule
```

This allows cache configuration to remain centralized without moving database implementation concerns into functional modules.

---

# Design units and dependency composition

The library follows these mandatory design rules:

- Default to a class for cohesive logic, including validation, encoding, construction, and
  composition. A class must have one cohesive responsibility; generic `Manager`, `Helper`, and
  catch-all `Service` classes are not acceptable abstractions.
- Use a standalone function only when its behavior is plainly stateless, has no validation or
  collaborators, and does not benefit from encapsulation. A stable public function may also be a
  thin compatibility facade that delegates immediately to an internal class.
- Keep behavior that exists solely to support a class inside that class as a private method or
  member. A source file contains either a class or standalone function declarations, never both;
  class methods and required callbacks are part of the class rather than standalone operations.
- Comments explain non-obvious decisions, constraints, or tool metadata. Do not use comments to
  restate names, types, or control flow that the code already expresses.
- Use an immutable internal Value Object when a primitive has a stable technical meaning and
  invariant that must survive beyond an input boundary. Cache namespace, resource name, key
  version, TTL, and the built cache key are examples. Keep the public declarative policy ergonomic:
  compilation, rather than consumers, constructs internal Value Objects.
- Introduce a port only when an inner component needs a variable external capability. The port
  belongs to the inner consumer and its implementation stays at the outer boundary.
- Inject dependencies through constructors or explicit factory arguments. Do not use global
  service locators or let the framework container leak into the framework-independent core.
- NestJS is the composition root. Its providers and factories assemble concrete cache stores,
  options, and runtime collaborators; they do not move NestJS types, decorators, or
  `cache-manager` dependencies into the core.

The required dependency direction is:

```text
infrastructure/nest -> application/runtime -> domain/key / domain/policy
```

```text
src/
├── domain/
│   ├── key/
│   └── policy/
├── application/
│   └── runtime/
└── infrastructure/
    └── nest/
```

`domain/key` and `domain/policy` must remain independent of runtime proxying, NestJS, and cache
backends. `application/runtime` may depend on the domain and internal ports, but not NestJS.
Public exports are intentional: internal ports, compiled policy representations, implementation
tokens, value envelopes, and proxy details do not become consumer API by default.

---

# Architecture boundary enforcement

Once the library source has explicit architecture layers, this repository must use
[`@jfrz38/eslint-plugin-clean-architecture-highlighter`](https://github.com/jfrz38/clean-architecture-highlighter)
to enforce their allowed import direction in local linting and CI.

The layer mapping, aliases, and allowed dependencies must be recorded with the source
structure that introduces them. The tool is not configured before that point: assigning the
functional folders to `domain`, `application`, or `infrastructure` without stable boundaries
would create misleading violations. Activating the rule is a delivery requirement of Iteration
06. Its mapping must enforce the documented `infrastructure/nest -> application/runtime ->
domain/key / domain/policy` direction, including the prohibition on NestJS or backend imports
from the core.

---

# Separate cache policy files

Large policies should not have to live directly inside NestJS modules.

Recommended:

```text
cache/
├── application-cache.module.ts
├── user.cache-policy.ts
└── organization.cache-policy.ts
```

Example:

```ts
export const userCachePolicy = defineCachePolicy<UserRepository>()({
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
CacheProxyModule.forFeature([
  {
    provide: UserRepository,
    useClass: SqlUserRepository,
    policy: userCachePolicy,
  },
]);
```

This keeps module files small.

---

# TypeScript-first policy configuration

The primary configuration mechanism should be strongly typed TypeScript.

Example:

```ts
export const userCachePolicy = defineCachePolicy<UserRepository>()({
  resources: {
    userByCriteria: {
      method: 'matching',
      version: 1,
      ttl: 300_000,

      key: ([criteria]) => ({
        tenantId: criteria.tenantId,

        email: criteria.email,
      }),
    },
  },

  methods: {
    matching: {
      cache: 'userByCriteria',
    },
  },
});
```

This should be the recommended approach.

Benefits:

- TypeScript type safety
- refactor safety
- IDE autocomplete
- direct access to method arguments
- value-object support
- composability
- compile-time detection of many configuration errors

---

# Avoid template engines as the primary API

The primary API should not rely on:

```text
user:{{criteria.email}}
```

or generic template engines such as Mustache.

Template strings lose:

- type safety
- autocomplete
- rename support
- compile-time property checks
- complex value support

A refactor from:

```ts
criteria.email;
```

to:

```ts
criteria.contact.email;
```

could silently break a string template.

With TypeScript:

```ts
key: ([criteria]) => criteria.contact.email;
```

the compiler can help detect the change.

---

# Optional key template helpers

The library may later expose limited key helpers for simple cases.

For example:

```ts
key: keyBy(
  ([criteria]) => criteria.email,

  ([criteria]) => criteria.status,
);
```

or:

```ts
key: keyByArg(0);
```

These helpers should preserve type safety.

Avoid introducing a generic template engine unless there is a compelling use case.

---

# Structured cache key input

The `key` function should not necessarily need to return a string.

Prefer supporting structured values:

```ts
key: ([id]) => id;
```

```ts
key: ([tenantId, id]) => [tenantId, id];
```

```ts
key: ([criteria]) => ({
  tenantId: criteria.tenantId,

  email: criteria.email,
});
```

The library normalizes the result deterministically with the public key contract:

```ts
buildCacheKey({
  namespace: { application: 'users-api', environment: 'production' },
  resource: 'userById',
  version: 2,
  input: { tenantId, id },
});
```

The final key has prefix `ncp:k1:` followed by fixed-order tagged JSON. It accepts only
`null`, booleans, finite numbers, strings, dense arrays, and plain string-keyed objects.
Object keys sort recursively by UTF-16 code-unit order; numbers are tagged strings so `-0`
remains distinct from `0`. Unsupported instances, accessors, symbols, cycles, sparse arrays,
and non-finite numbers fail before cache access.

This reduces manual string composition and accidental collisions.

---

# Advanced policy classes

Most applications should use object policies.

However, advanced users may require classes.

Example:

```ts
@Injectable()
export class UserCachePolicy implements CachePolicy<UserRepository> {
  // policy definition
}
```

This may be useful when policy construction needs:

- injected configuration
- shared services
- complex key construction
- dynamic runtime values

Class-based policies should be an advanced escape hatch, not the primary API.

---

# Cache resources

A cache resource represents one cached representation.

Example:

```ts
resources: {
  userById: {
    version: 1,
    ttl: 300_000,
    key: ([id]) => id,
  },

  userByCriteria: {
    version: 1,
    ttl: 60_000,

    key: ([criteria]) => ({
      tenantId:
        criteria.tenantId,

      email:
        criteria.email,
    }),
  },
}
```

Resources should define:

- key derivation
- TTL
- version

For the MVP, TTL is a positive integer number of milliseconds. Duration strings in
future-facing examples are not part of the initial public API.

Potential additional options:

- negative caching
- serialization
- TTL jitter
- stale TTL
- coalescing
- tags
- cache tier

---

# Cache-aside

For:

```ts
methods: {
  matching: {
    cache: 'userByCriteria',
  },
}
```

the proxy should perform:

```text
matching(criteria)
       │
       ▼
build cache key
       │
       ▼
cache.get()
       │
       ├── HIT
       │    │
       │    ▼
       │  return
       │
       └── MISS
            │
            ▼
     provider.matching()
            │
            ▼
       cache.set()
            │
            ▼
          return
```

This behavior corresponds to the manual decorator:

```ts
async matching(criteria: Criteria) {
  const cached =
    await cache.get(key);

  if (cached !== MISS) {
    return cached;
  }

  const result =
    await provider.matching(
      criteria,
    );

  await cache.set(
    key,
    result,
  );

  return result;
}
```

The library generates this behavior automatically.

---

# Passthrough methods

Methods without configured cache behavior must simply call the underlying provider.

Example:

```ts
methods: {
  matching: {
    cache: 'userByCriteria',
  },
}
```

If `save` is not configured:

```ts
save(user);
```

becomes:

```ts
return concreteProvider.save(user);
```

No other behavior should be added.

---

# Exact-key invalidation

A mutation may invalidate explicitly derived cache entries. The MVP does not enumerate
all keys belonging to a dynamic resource: cache-manager/Keyv does not provide a portable
prefix scan or resource-wide delete contract.

Example:

```ts
methods: {
  save: {
    effects: [
      {
        invalidate: {
          resource: 'userById',
          keyArgs: ({ args }) => [args[0].id],
        },
      },
    ],
  },
}
```

Execution:

```text
save(user)
   │
   ▼
SqlUserRepository.save(user)
   │
   ▼
success
   │
   ▼
delete configured exact keys
   │
   ▼
return
```

If the repository operation fails, invalidation must not happen.

A resource-wide invalidation is only equivalent to exact-key deletion when the resource
has one constant key. Dynamic resource invalidation requires tags, an index, generations,
or backend-specific scanning and is post-MVP.

---

# Write-through

If a mutation returns the canonical updated entity, the library should support using the result to update the cache.

Example:

```ts
update: {
  effects: [
    {
      writeThrough: {
        resource: 'userById',

        keyArgs: ({ args }) => [
          args[0],
        ],

        value: ({ result }) =>
          result,
      },
    },
  ],
}
```

Execution:

```text
update(id, data)
      │
      ▼
SQL update
      │
      ▼
updated User
      │
      ▼
cache.set(userById)
      │
      ▼
return User
```

Do not execute an unnecessary additional query when the mutation already returns the canonical result.

---

# Explicit refresh (post-MVP)

A provider method may optionally trigger another read method after mutation.

Example:

```ts
update: {
  refresh: {
    method: 'findById',

    args: ({ args }) => [
      args[0],
    ],
  },
}
```

When a mutation combines strategies, the MVP represents them as an `effects` array and
executes them sequentially in declaration order. Policy validation should reject an effect
sequence that writes and then deletes the same exact key. Preferred strategy selection is:

1. write-through
2. invalidation
3. explicit refresh

Refresh should not be the default.

---

# Cache key contracts

Cache keys are persistent contracts.

Cached values may survive:

- process restarts
- deployments
- rolling deployments
- code refactors
- provider signature changes
- application version changes

Keys must therefore be:

- deterministic
- versioned
- strongly typed
- testable

---

# Strong typing against provider methods

Configuration should infer method names and arguments.

In the MVP, configured method names are restricted to methods returning `Promise<T>`.
Unconfigured methods retain normal passthrough behavior regardless of their return type.
The proxy must not convert a synchronous or streaming contract into a promise.

Conceptually:

```ts
type MethodArgs<T, K extends keyof T> = T[K] extends (
  ...args: infer A
) => unknown
  ? A
  : never;
```

Given:

```ts
interface UserRepository {
  matching(criteria: Criteria): Promise<User>;
}
```

the key builder receives:

```ts
[Criteria];
```

If the method signature changes, the policy should receive the new argument tuple.

---

# Refactor safety

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

The library should protect users through:

1. TypeScript typing
2. cache contract tests
3. explicit resource versions

---

# Object parameters

For complex cacheable methods, object parameters are preferable.

More fragile:

```ts
findById(
  tenantId: string,
  id: string,
)
```

Safer:

```ts
findById({
  tenantId,
  id,
}: FindUserQuery)
```

Then:

```ts
key: ([query]) => ({
  tenantId: query.tenantId,

  id: query.id,
});
```

This gives better refactor safety.

---

# Resource versioning

Resources should have explicit versions.

Example:

```ts
userById: {
  version: 2,
  ttl: 300_000,
  key: ([id]) => id,
}
```

A version bump isolates new entries; it does not migrate or remove entries under an earlier
version. A representation change to the `k1` payload requires a new key-format prefix rather
than silently changing `k1`.

A version bump should occur for breaking changes to:

- key semantics
- method argument interpretation
- serialization format
- result representation
- tenant scope
- authorization scope
- query meaning

---

# Global namespaces

The global namespace is an explicit object:

```ts
{ application: 'users-api', environment: 'production' }
```

It is embedded as tagged `k1` JSON with the resource and version, so delimiter-containing
values cannot collide. Namespace components are non-empty strings and are not Unicode
normalized: literal values represent distinct application identities. Global namespaces should
be configured once in application composition. Tenant identity belongs in the structured input
for tenant-scoped resources.

---

# Key collisions

Key generation must be unambiguous.

Bad:

```ts
`${tenantId}${userId}`;
```

because:

```text
12 + 3 = 123
1 + 23 = 123
```

Structured key inputs should help avoid this problem.

---

# Sensitive information in keys

Avoid exposing:

- passwords
- tokens
- API keys
- JWTs
- secrets
- sensitive user data

Future helpers may support deterministic hashing.

Raw keys should not normally be logged.

---

# Multi-tenancy

Tenant identity must be included whenever data depends on tenant scope.

Unsafe:

```ts
key: ([id]) => id;
```

when `id` is only unique within a tenant.

Safe:

```ts
key: ([query]) => ({
  tenantId: query.tenantId,

  id: query.id,
});
```

Cross-tenant cache collisions can become security vulnerabilities.

---

# Null, misses, and negative caching

The cache layer must distinguish:

```text
MISS
```

from:

```text
cached null
```

A versioned internal envelope distinguishes stored values from backend miss values. Falsy
values and `null` can therefore be cached without ambiguity. `undefined` is never cached.
Configurable negative caching policy and a separate negative TTL remain post-MVP.

Example post-MVP option:

```ts
userById: {
  cacheNull: true,
  negativeTtl: '30s',
}
```

This can prevent repeated queries for known missing values.

---

# Serialization

Distributed caches may not preserve:

- prototypes
- `Date`
- `BigInt`
- `Map`
- `Set`
- value objects
- custom classes

The architecture should support serialization hooks:

```ts
serialize: value => ...
deserialize: value => ...
```

A serialization format change may require a resource version bump.

---

# Local cache

Local memory caches should work transparently.

```text
Nest process
    │
    ▼
Memory cache
    │
    ▼
Provider
```

Useful for:

- development
- tests
- single-instance applications
- very short-lived data

Memory caches are process-local.

---

# Distributed cache

Redis or another shared store allows:

```text
App A ─┐
       │
App B ─┼──► Redis
       │
App C ─┘
```

All instances can access shared cached data.

---

# Remote KV

Keyv-compatible or custom adapters should allow other remote KV stores.

The provider policy must remain backend-independent.

---

# Multi-level caching

The architecture should not prevent:

```text
Provider Proxy
      │
      ▼
L1 Memory
      │
      ▼
L2 Redis
      │
      ▼
Provider
```

However, L1 invalidation across multiple application instances is non-trivial.

Do not claim strong consistency without propagation.

---

# Transactions

Provider-level caching cannot automatically understand every database transaction.

Unsafe scenario:

```text
UPDATE inside transaction
        │
        ▼
cache invalidated
        │
        ▼
transaction rollback
```

Future integrations may support:

- post-commit hooks
- transaction contexts
- event-driven invalidation

The initial version must document this limitation.

---

# Cache failures

The default should normally be fail-open.

```text
cache GET fails
      │
      ▼
execute provider
```

```text
provider succeeds
      │
      ▼
cache SET fails
      │
      ▼
return provider result
```

Provider failures must always propagate.

The MVP reports cache get, set, and delete failures through a minimal, non-throwing error
hook. Hook payloads must identify the operation without exposing raw keys or values.

---

# Cache operation timeouts

A slow cache may be worse than a database call.

Future support:

```ts
CacheProxyModule.forRoot({
  timeout: {
    get: '50ms',
    set: '100ms',
  },
});
```

Timeouts may trigger fail-open behavior.

---

# Cache stampede

Concurrent misses for the same key can generate excessive provider calls.

Future `single-flight` / request coalescing:

```text
100 cache misses
       │
       ▼
1 provider call
       │
       ▼
shared result
```

Potential option:

```ts
coalesce: true;
```

---

# TTL jitter

Future support may allow:

```ts
ttl: '5m',
jitter: 0.1,
```

to avoid synchronized expirations.

---

# Bulk methods

Methods such as:

```ts
findByIds(ids);
```

may either cache:

- the entire query result
- individual entities

The first version should not automatically decompose bulk operations.

Keep behavior explicit.

---

# Pagination and filtering

Queries such as:

```ts
matching({
  page,
  size,
  status,
  tenant,
});
```

may create many distinct cache entries.

The library should not attempt automatic query optimization.

Future cache tags may help invalidation.

---

# Cache tags

Potential future feature:

```ts
tags: ({ result }) => ['users', `user:${result.id}`];
```

Mutations may invalidate tags instead of enumerating every query resource.

Not required for MVP.

---

# Observability

The longer-term library should expose hooks/events for:

```text
cache.hit
cache.miss
cache.set
cache.invalidate
cache.error
cache.bypass
cache.coalesced
```

The MVP exposes only the redacted cache error hook described above. Hit/miss metrics,
general event streams, and OpenTelemetry integration are post-MVP.

Useful dimensions:

- provider
- method
- resource
- backend
- latency

Do not emit complete keys or values by default.

---

# OpenTelemetry

Potential spans:

```text
cache.get
cache.set
cache.invalidate
provider.execute
```

Potential attributes:

```text
cache.resource
cache.operation
cache.hit
cache.backend
provider.name
provider.method
```

---

# Debugging

Future debug mode:

```ts
CacheProxyModule.forRoot({
  debug: true,
});
```

Possible diagnostic:

```text
UserRepository.matching
resource=userByCriteria
version=2
cache=MISS
provider=EXECUTED
ttl=300s
```

Avoid full cache values and sensitive keys.

---

# Cache bypass

Applications may need to explicitly bypass cache without modifying provider interfaces.

Potential future API:

```ts
cacheContext.run({ bypass: true }, () => repository.matching(criteria));
```

Do not add parameters such as:

```ts
matching(criteria, skipCache);
```

to application interfaces.

---

# Testing philosophy

The concrete provider should continue being tested independently.

Example:

```ts
describe('SqlUserRepository', () => {
  // SQL tests
});
```

Cache behavior should be tested separately.

---

# Cache behavior testing

Tests should cover:

- hit skips provider
- miss calls provider
- miss stores result
- TTL is applied
- correct key is used
- null handling
- passthrough methods
- provider errors
- cache errors
- invalidation
- write-through

---

# Cache contract tests

Example:

```ts
expectCacheKey(userCachePolicy)
  .for('matching')
  .withArgs(criteria)
  .toBe('users-api:prod:userByCriteria:v1:...');
```

Or:

```ts
cacheContract({
  provider: UserRepository,
  policy: userCachePolicy,

  cases: {
    matching: [
      {
        args: [criteria],
        expectedKey: 'userByCriteria:v1:...',
      },
    ],
  },
});
```

The exact testing API may evolve.

---

# Cache contract snapshots

Potential future file:

```text
.cache-contract.json
```

Potential CLI:

```bash
nestjs-cache-proxy check
```

It may detect:

- changed keys
- changed resources
- removed methods
- missing version bumps
- collisions
- invalid references

---

# Deterministic test cache

Tests should have access to a deterministic in-memory cache or recommended testing adapter.

Useful features:

- clear/reset
- inspect keys
- inspect values
- deterministic TTL
- fake-clock compatibility

---

# Reusable policies

Reusable definitions should eventually be supported.

Example:

```ts
const entityCache = defineCacheResource({
  version: 1,
  ttl: 300_000,
});
```

Then:

```ts
userById: entityCache({
  key: ([id]) => id,
});
```

---

# Example complete application configuration

Policy:

```ts
export const userCachePolicy = defineCachePolicy<UserRepository>({
  resources: {
    userById: {
      version: 1,
      ttl: 300_000,
      key: ([id]) => id,
    },

    users: {
      version: 1,
      ttl: 60_000,
      key: () => 'all',
    },
  },

  methods: {
    findById: {
      cache: 'userById',
    },

    save: {
      effects: [
        {
          invalidate: {
            resource: 'users',
            keyArgs: () => [],
          },
        },
      ],
    },

    update: {
      effects: [
        {
          writeThrough: {
            resource: 'userById',

            keyArgs: ({ args }) => [args[0]],

            value: ({ result }) => result,
          },
        },
        {
          invalidate: {
            resource: 'users',
            keyArgs: () => [],
          },
        },
      ],
    },

    delete: {
      effects: [
        {
          invalidate: {
            resource: 'userById',
            keyArgs: ({ args }) => [args[0]],
          },
        },
        {
          invalidate: {
            resource: 'users',
            keyArgs: () => [],
          },
        },
      ],
    },
  },
});
```

This complete MVP example intentionally does not cache `matching(criteria)`: the shown
mutations do not carry enough information to derive every affected criteria key exactly.
Caching that query requires domain-specific exact derivation, acceptance of TTL-bounded
staleness, or a post-MVP indexed invalidation mechanism.

Application cache module:

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

  exports: [CacheProxyModule],
})
export class ApplicationCacheModule {}
```

Users module:

```ts
@Module({
  imports: [ApplicationCacheModule],

  providers: [UserByCriteriaSearcher],
})
export class UsersModule {}
```

Use case:

```ts
@Injectable()
export class UserByCriteriaSearcher {
  constructor(private readonly repository: UserRepository) {}

  execute(criteria: Criteria) {
    return this.repository.matching(criteria);
  }
}
```

Concrete repository:

```ts
@Injectable()
export class SqlUserRepository implements UserRepository {
  async matching(criteria: Criteria): Promise<User> {
    // SQL
  }

  async findById(id: string): Promise<User | null> {
    // SQL
  }

  async save(user: User): Promise<void> {
    // SQL
  }

  async update(id: string, user: User): Promise<User> {
    // SQL
  }

  async delete(id: string): Promise<void> {
    // SQL
  }
}
```

Runtime structure:

```text
UserByCriteriaSearcher
        │
        ▼
UserRepository token
        │
        ▼
Caching Proxy
        │
        ├── CACHE_MANAGER
        │
        ▼
SqlUserRepository
        │
        ▼
PostgreSQL
```

---

# Example caching a use case instead

The same mechanism must support application services or use cases.

Example:

```ts
export abstract class UserByCriteriaSearcher {
  abstract execute(criteria: Criteria): Promise<User>;
}
```

Concrete implementation:

```ts
@Injectable()
export class DefaultUserByCriteriaSearcher implements UserByCriteriaSearcher {
  constructor(private readonly repository: UserRepository) {}

  execute(criteria: Criteria) {
    return this.repository.matching(criteria);
  }
}
```

Policy:

```ts
export const userSearcherCache = defineCachePolicy<UserByCriteriaSearcher>({
  resources: {
    searchResult: {
      version: 1,
      ttl: 120_000,

      key: ([criteria]) => ({
        tenantId: criteria.tenantId,

        email: criteria.email,
      }),
    },
  },

  methods: {
    execute: {
      cache: 'searchResult',
    },
  },
});
```

Registration:

```ts
CacheProxyModule.forFeature([
  {
    provide: UserByCriteriaSearcher,

    useClass: DefaultUserByCriteriaSearcher,

    policy: userSearcherCache,
  },
]);
```

Runtime:

```text
Controller
   │
   ▼
UserByCriteriaSearcher
   │
   ▼
Caching Proxy
   │
   ▼
DefaultUserByCriteriaSearcher
   │
   ▼
UserRepository
```

This demonstrates that repository caching is not a special case in the library architecture.

---

# Where to cache

Caching different layers has different semantics.

## Repository cache

```text
Use Case
   │
   ▼
Cached Repository
   │
   ▼
Database
```

Advantages:

- reusable across multiple use cases
- close to the persistence query
- fine-grained data caching

## Use-case cache

```text
Controller
   │
   ▼
Cached Use Case
   │
   ▼
Repositories / Services
```

Advantages:

- caches final application results
- may avoid multiple repository calls
- may cache expensive calculations

Trade-off:

- invalidation may become semantically broader

The library should support both rather than deciding where applications must cache.

---

# MVP

The MVP should include:

1. `cachedProvider`
2. `defineCachePolicy`
3. `CacheProxyModule.forRoot`
4. `CacheProxyModule.forFeature`
5. `useClass` provider wrapping
6. JavaScript runtime proxy for `Promise<T>` methods
7. strongly typed provider methods
8. explicit resources
9. cache-aside
10. passthrough methods
11. TTL in milliseconds
12. deterministic keys
13. structured key input
14. namespaces
15. resource versions
16. exact-key invalidation
17. write-through
18. `CACHE_MANAGER` integration
19. memory compatibility
20. one verified Redis/Keyv configuration
21. null/miss distinction through an internal value envelope
22. fail-open cache errors and a minimal error hook
23. cache contract testing
24. configuration validation
25. centralized cache-module support
26. singleton `useClass` providers and runtime NestJS tokens

---

# MVP+1

High-value next features:

- `useExisting`
- negative caching
- request coalescing
- TTL jitter
- serialization hooks
- metrics
- OpenTelemetry
- reusable resource policies
- explicit cache bypass
- operation timeouts
- advanced policy classes

---

# Future scope

Potential features:

- cache tags
- dependency graphs
- L1/L2 caching
- distributed L1 invalidation
- Redis Pub/Sub
- event-driven invalidation
- async invalidation
- stale-while-revalidate
- circuit breaker
- named cache tiers
- store selection by resource
- contract snapshots
- CLI validation
- CI validation
- key collision testing
- transaction-aware integration
- bulk entity caching
- custom consistency models

---

# Explicitly out of scope

Initially avoid:

- HTTP caching
- ETags
- `Cache-Control`
- CDN integration
- database replication
- write-behind
- automatic classification based on method names
- decorators inside cached providers
- ORM query parsing
- automatic transaction interception
- automatic cache migrations
- Redis-specific policy syntax

---

# Design constraints

Prioritize:

- transparency
- type safety
- explicit policies
- centralized configuration
- minimal boilerplate
- NestJS-native DI
- dependency inversion
- backend independence
- deterministic cache contracts
- refactor safety
- observability
- testability
- correctness

Avoid:

- hidden magic
- cache annotations inside domain/application providers
- duplicated key definitions
- backend-specific policies
- unsafe implicit serialization
- silently swallowed provider errors
- coupling consumers to caching

---

# Core invariants

## 1. The wrapped provider remains the source of truth

Caching must not replace the underlying operation semantics.

## 2. The wrapped implementation remains cache-agnostic

No cache dependencies belong inside it.

## 3. Consumers remain cache-agnostic

The injected token remains unchanged.

## 4. The cache proxy is transparent

Configured behavior aside, the provider should behave exactly as before.

## 5. Unconfigured methods are passthrough

They execute directly against the concrete provider.

## 6. Provider failures propagate

Caching must never hide underlying failures.

## 7. Cache failures normally fail open

An unavailable cache should normally not make the provider unavailable.

## 8. Mutations happen before cache effects

Never update cache based on a failed source-of-truth mutation.

## 9. Cache keys are contracts

Changes must be deliberate and testable.

## 10. Versions isolate incompatible representations

Breaking changes should move to a new resource version.

## 11. Policies describe semantics, not backend technology

The same policy should work with memory, Redis, or another compatible store.

## 12. Caching belongs to composition

Applications should be able to configure caching entirely from NestJS modules or external policy files.

---

# Initial implementation plan

The maintained implementation plan is split into reviewable, evidence-driven documents
under [`docs/iterations`](iterations/README.md). The phases below are a conceptual summary;
the iteration documents define scope, dependencies, acceptance criteria, and completion
evidence.

## Phase 1 — Public API

Define:

- `cachedProvider`
- `defineCachePolicy`
- `CacheProxyModule`
- `forRoot`
- `forFeature`
- provider policy types
- resource types
- method inference
- structured key types

Do not implement substantial runtime behavior before the public TypeScript API is coherent.

---

## Phase 2 — Minimal runtime proxy

Implement:

```text
method call
   │
   ▼
cache GET
   │
   ▼ miss
concrete provider
   │
   ▼
cache SET
   │
   ▼
return
```

Support a single read resource.

---

## Phase 3 — NestJS DI

Implement:

```text
public token
    │
    ▼
factory provider
    │
    ├── concrete implementation
    ├── CACHE_MANAGER
    └── cache policy
```

Verify transparent injection.

The initial implementation is limited to singleton `useClass` providers and runtime
NestJS tokens.

---

## Phase 4 — Dynamic modules

Implement:

```ts
CacheProxyModule.forRoot(...)
```

and:

```ts
CacheProxyModule.forFeature(...)
```

Verify that applications can create a dedicated `ApplicationCacheModule`.

---

## Phase 5 — Key contracts

Implement:

- namespace
- resource name
- version
- deterministic canonical key encoding
- contract testing helpers

---

## Phase 6 — Mutations

Implement:

- exact-key invalidation
- multiple invalidations
- write-through

---

## Phase 7 — Resilience

Implement:

- cache fail-open
- provider error propagation
- cache operation error hooks

---

## Phase 8 — Null and serialization boundaries

Implement:

- cache miss sentinel
- cached null
- documented serialization semantics

---

## Phase 9 — Testing utilities

Provide:

- deterministic test cache
- key assertions
- cache behavior assertions
- contract tests

---

## Phase 10 — Integration tests

Test:

- provider proxying
- `forRoot`
- `forFeature`
- centralized cache modules
- memory cache
- Redis-compatible backend
- repository provider
- use-case provider

---

# Long-term direction

The value proposition should remain:

```text
NestJS DI
    +
transparent provider proxies
    +
declarative TypeScript policies
    +
centralized cache composition
    +
strong type inference
    +
versioned cache contracts
    +
backend independence
    +
testing
    +
observability
```

`nestjs-cache-proxy` should make adding application-level caching feel like a dependency-injection configuration concern rather than something that requires rewriting providers.

The ideal developer experience is:

```ts
CacheProxyModule.forFeature([
  {
    provide: UserRepository,
    useClass: SqlUserRepository,
    policy: userCachePolicy,
  },
]);
```

while this:

```ts
export class UserByCriteriaSearcher {
  constructor(private readonly repository: UserRepository) {}
}
```

and this:

```ts
export class SqlUserRepository implements UserRepository {
  // ...
}
```

remain completely unaware that caching exists.
