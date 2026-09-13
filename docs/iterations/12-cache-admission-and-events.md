# Iteration 12: Cache Admission and Events

## Status

Complete

## Objective

Allow policies to decide whether a computed value is eligible for storage, and let applications
observe redacted cache operation outcomes without coupling providers to cache infrastructure.

## Decisions

- A resource may declare synchronous `cacheIf({ args, result })`. Only a strict `true` admits a
  write; omitted predicates preserve the existing envelope behavior.
- A skipped admission does not delete or otherwise alter an existing cache entry.
- Cache-aside receives the provider method arguments and result. Write-through receives the target
  resource's derived key arguments and projected value.
- Predicate failures are fail-open: the provider result remains unchanged, no write occurs, and a
  redacted `set/error` event is emitted.
- `onCacheEvent` is a root-only synchronous-or-asynchronous observational hook. Its failures are
  swallowed and do not create recursive events.
- Events report only a semantic type, operation, outcome, resource, and a fresh sanitized cause
  on errors. They do not expose keys, arguments, values, payloads, or durations.
- `onCacheError` is replaced directly because no released consumers require compatibility.

## Event Contract

- `get`: `hit`, `miss`, or `error`
- `set`: `success`, `skipped`, or `error`
- `delete`: `success` or `error`
- `CacheEventType` provides a single discriminant for each combination, such as
  `CacheEventType.GET_HIT` and `CacheEventType.SET_SKIPPED`.

## Acceptance Evidence

- Runtime tests cover admission for wrapped missing values, target write-through inputs, predicate
  failure, and all cache-operation outcomes.
- Policy validation rejects non-function admission predicates, and type tests verify inferred
  predicate arguments and results.
- Nest integration verifies redacted root error events.
- `make lint`, `make typecheck`, and `make test` pass. `make format-check` remains blocked by
  pre-existing formatting debt in unchanged files.
