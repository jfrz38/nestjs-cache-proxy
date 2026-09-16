# Cache in use case

## What this recipe shows

`FindBookUseCase.dispatch()` is cached while its `BookCatalog` dependency remains
uncached. Consumers inject the use-case token and do not need to know that a
proxy wraps its implementation.

## Things to consider

Caching at this boundary can be useful when the complete application operation,
including coordination or transformation, defines the reusable result. It also
avoids imposing one cache policy on every consumer of the underlying catalog.

A repository-level cache may fit better when several operations perform the same
read and should share entries. Consider which inputs affect the result, including
tenant, permissions, locale, or other request context, before defining the key.

## How it works

On a cache miss, the proxy calls `dispatch()` and stores its result for 60
seconds. The use case continues to receive a normal `BookCatalog`; caching its
result does not change or decorate that dependency.

The module uses `cachedProvider()` directly because `FindBookUseCaseHandler`
depends on `BOOK_CATALOG`, which is owned by the same feature module. Providers
imported by a parent feature module are not automatically visible inside the
dynamic module returned by `forFeature()`.

## Files

| File                          | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| `book-catalog.ts`             | Catalog token and uncached dependency contract.      |
| `find-book.use-case.ts`       | Cached operation contract and implementation.        |
| `find-book.cache-policy.ts`   | Cache resource and `dispatch()` rule.                |
| `cache-in-use-case.module.ts` | Direct provider composition with `cachedProvider()`. |

## Adapt the recipe

Replace the in-memory catalog, namespace, TTL, and key. If contextual data can
change the result, make it an explicit method argument or choose a boundary where
that context can be represented safely in the cache key.
