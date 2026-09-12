# Iteration 06: Dynamic Modules

## Status

Complete

## Context and motivation

Applications need centralized global cache options and domain-local cached-provider
registrations without importing cache details into business providers or consumers.

## Objective

Implement `CacheProxyModule.forRoot` and `CacheProxyModule.forFeature` as predictable
NestJS dynamic modules that consume an application-owned `CACHE_MANAGER`.

## Architectural decisions

- `forRoot` configures library options only; it never registers a hidden cache backend.
- The application imports NestJS `CacheModule` (or otherwise provides `CACHE_MANAGER`).
- `forFeature` delegates each descriptor to `cachedProvider` and exports public tokens.
- One effective root configuration exists per Nest application context for the MVP.
- Calling `forRoot` more than once is unsupported and must be documented; detect duplicate
  configuration where NestJS composition permits reliable detection.
- Duplicate public tokens within one `forFeature` call are rejected. Across imported
  modules, normal NestJS visibility rules apply and applications must avoid ambiguity.
- A dedicated application cache module is recommended, not required.

## Functional scope

- Configure a namespace globally. Cache error reporting remains deferred to Iteration 08.
- Register multiple cached providers in one or several feature modules.
- Re-export public cached tokens to importing modules.
- Support a centralized `ApplicationCacheModule` composition pattern.

## Technical scope

- Root options token, normalized options provider, and dynamic module metadata.
- Feature provider flattening and exports.
- Validation of empty namespace, duplicate feature token, and absent cache manager.
- `forRoot` makes only the normalized options provider global so child feature modules can retain
  the `forFeature(registrations)` API. Applications make `CACHE_MANAGER` global through
  `CacheModule.register({ isGlobal: true })` or an equivalent global application module.
- Establish the library layer mapping and enable
  `@jfrz38/eslint-plugin-clean-architecture-highlighter` as a local and CI lint gate.
- Enforce `nest -> runtime -> key / policy`; reject NestJS or backend imports from the core and
  prevent internal ports and tokens from becoming public API.

## Expected files and components

- `src/infrastructure/nest/cache-proxy.module.ts`
- `src/infrastructure/nest/cache-proxy-options.ts`
- `src/infrastructure/nest/cached-provider.ts`
- multi-module Nest integration fixtures
- examples for centralized composition

## Detailed steps

1. Define synchronous `forRoot` options needed by the MVP.
2. Normalize and validate root options once.
3. Build `forFeature` metadata from one or more `useClass` registrations.
4. Export only public tokens, never internal implementation tokens.
5. Test feature modules imported through an application cache module.
6. Test multiple independent cached providers and resource names.
7. Document root/feature placement, import visibility, and duplicate semantics.
8. Record the layer aliases and allowed dependencies, then enable the architecture lint rule
   for the documented dependency direction.

## Tests

- Integration tests for `forRoot`, `forFeature`, and centralized application modules.
- Multiple-provider tests using class, string, and symbol tokens.
- Tests proving internal tokens cannot be imported as public API.
- Bootstrap failure tests for missing `CACHE_MANAGER`, invalid options, and local duplicate
  registrations.
- ESLint rejects prohibited cross-layer imports in the project source.
- ESLint rejects NestJS/backend imports from `runtime`, `key`, or `policy`.

## Acceptance criteria

- An application-owned cache manager is used by every registered proxy.
- Multiple cached providers resolve and operate independently.
- Feature modules export only their configured public tokens.
- A documented centralized module works without provider/consumer cache awareness.
- Invalid composition fails at bootstrap rather than on the first method call where
  technically possible.
- Local linting and CI reject imports that violate the documented layer mapping.

## Definition of Done

The global Definition of Done applies. At least one fixture mirrors realistic domain,
infrastructure, cache-composition, and consumer module boundaries.

## Non-goals

- Configuring memory or Redis stores inside `CacheProxyModule`
- Async root configuration unless a demonstrated MVP need requires it
- Multiple named cache tiers or per-resource stores
- Automatic provider discovery

## Risks and mitigations

- **Risk:** Nest module token generation deduplicates unexpected dynamic modules.
  **Mitigation:** inspect generated module behavior with multi-feature integration tests.
- **Risk:** global-module shortcuts obscure ownership. **Mitigation:** prefer explicit
  imports and exports.
- **Risk:** duplicate roots are difficult to detect universally. **Mitigation:** document
  the invariant and test supported composition shapes without unreliable global state.

## Dependencies

- Iteration 05

## Documentation updates

Publish root and feature API examples, application-owned `CacheModule` setup, centralized
composition, token export rules, and duplicate-registration limitations.

## Exit evidence

- `make check` verifies the multi-module fixture, root and feature validation, architecture lint
  rule, package compilation, and documentation formatting.
- The Nest fixture composes a global application-owned `CacheModule`, one root module, a feature
  module with class, string, and symbol tokens, and an importing consumer module.
- Feature metadata inspection verifies that only configured public tokens are exported.
- Bootstrap validation covers invalid namespaces, duplicate local registrations, and a missing
  application-owned `CACHE_MANAGER`.
