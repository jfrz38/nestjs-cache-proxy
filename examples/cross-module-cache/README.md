# Cross-module cache

## What this recipe shows

`CatalogModule` owns a cached `BookReader`. `RecommendationsModule` imports the
catalog module and injects the exported reader token without knowing its concrete
implementation or cache policy.

## Things to consider

This composition can be useful when one module owns both a capability and its
cache behavior while several other modules consume it. Keeping registration in
the owner avoids duplicating policies or exposing the concrete implementation.

Export only deliberate public tokens. A consumer should not register the same
provider again, because that would create a separate instance and bypass the
owner's composition decision.

## How it works

`CatalogModule` registers `CACHED_BOOK_READER` through
`CacheProxyModule.forFeature()` and exports the returned dynamic module. NestJS
therefore exposes the proxy under that token. `RecommendationsModule` imports
`CatalogModule`, and `RecommendationsService` injects the token as it would any
other provider.

The reader caches `findById()` for 60 seconds. The recommendation service and
in-memory reader are illustrative; the important part is the module boundary and
the exported runtime token.

## Files

| File                          | Purpose                                    |
| ----------------------------- | ------------------------------------------ |
| `book-reader.ts`              | Exported runtime token and contract.       |
| `book-reader.cache-policy.ts` | Reader cache policy.                       |
| `catalog.module.ts`           | Owner and exporter of the cached provider. |
| `recommendations.service.ts`  | Consumer of the exported token.            |
| `recommendations.module.ts`   | Consumer-module composition.               |

## Adapt the recipe

Keep backend and `forRoot()` configuration in the application composition root.
Choose the token as part of the owning module's public contract and avoid
exporting the concrete implementation unless consumers genuinely require it.
