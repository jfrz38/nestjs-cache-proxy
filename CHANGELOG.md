# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- git-cliff: end of header -->
## [Unreleased]


### Added
- **policy:** Add typed cache policy API
- **key:** Add deterministic cache key contract
- **runtime:** Add cache-aside proxy
- Add NestJS cached provider integration
- Add dynamic cache proxy modules
- **policy:** Validate and compile mutation cache effects
- **runtime:** Execute source-first cache effects
- **runtime:** Add resilient cache value handling
- **nest:** Expose cache error hook
- Add deterministic testing API
- Add cache admission events
- Add CODEOWNERS file for repository ownership


### Fixed
- Resolve Nest constants in ESM consumers
- Decouple testing API from cache-manager types
- Preserve cache policy resource inference


### Changed
- Initial commit
- Create architecture definition
- Update architecture.md
- **core:** Encapsulate runtime behavior
- Encapsulate cache integration logic
- Split cache policy validation
- Merge remote-tracking branch 'origin/develop' into dependabot/github_actions/actions/checkout-7.0.1

# Conflicts:
#	.github/workflows/ci.yml
- Simplify architecture lint configuration
- Organize source by architecture layer
- Use default architecture lint layers
- **runtime:** Clarify cache policy execution types
- **policy:** Clarify cache effect types
- **errors:** Extract error metadata constants
- Simplify cache event contract

## Previously maintained history

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
- Node 22, 24, and 26 compatibility evidence for NestJS 11 and 12 with memory and the
  documented Redis/Keyv configuration.

Changing a resource key or cached value compatibility requires incrementing that resource's
`version`; the package does not migrate or remove old entries automatically.
