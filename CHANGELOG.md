# Changelog

All notable changes to this project are documented here.

## Unreleased

- Added resource-level `cacheIf({ args, result })` admission predicates for cache-aside and
  write-through writes. Skipped admissions preserve existing entries.
- Replaced `onCacheError` with redacted `onCacheEvent`, reporting get/set/delete outcomes while
  preserving fail-open provider behavior.
- Added `CacheEventType` for semantic cache-event outcome matching.
- Typed cache policies, deterministic versioned keys, cache-aside reads, exact invalidation,
  and write-through effects.
- NestJS dynamic-module composition for singleton `useClass` providers and a public testing
  entry point with a deterministic in-memory cache.
- Node 20, 22, and 24 compatibility evidence for NestJS 11 and 12 with memory and the
  documented Redis/Keyv configuration.

Changing a resource key or cached value compatibility requires incrementing that resource's
`version`; the package does not migrate or remove old entries automatically.
