# Cache in repository

## What this recipe shows

`BookRepository.findById()` uses cache-aside behavior. After a successful
`updateTitle()` call, the policy invalidates the exact `bookById` entry derived
from the mutation's first argument.

## Things to consider

Caching at the repository boundary can be useful when several application
operations reuse the same read and the repository owns the mutations that make
it stale. It keeps cache behavior close to data access and allows consumers to
keep injecting the repository token normally.

Another boundary may fit better when consumers need different projections,
authorization rules, TTLs, or consistency behavior for the same repository
method. Cache invalidation is not transaction-aware, so a surrounding database
transaction cannot roll it back.

## How it works

On a cache miss, the proxy calls `findById()` and stores the result for 60
seconds. `updateTitle()` always reaches the repository first. Only after it
succeeds does the proxy calculate the read key with `keyArgs` and invalidate it.
Invalidation targets one exact key; it does not scan or delete by prefix.

The module uses `CacheProxyModule.forFeature()` because the repository itself is
the cached provider and has no feature-owned constructor dependencies.

## Files

| File                              | Purpose                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `book-repository.ts`              | Public token and repository contract.                   |
| `in-memory-book-repository.ts`    | Illustrative implementation replacing real persistence. |
| `book-repository.cache-policy.ts` | Cached read and mutation invalidation rules.            |
| `cache-in-repository.module.ts`   | NestJS cache and provider composition.                  |

## Adapt the recipe

Replace the in-memory repository and example namespace. Review the TTL and key
for your access pattern, include tenant identity when required, and increment the
resource `version` whenever the key or cached value becomes incompatible.
