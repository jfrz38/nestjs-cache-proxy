# Implementation Iterations

This directory turns the [architecture](../architecture.md) into an executable delivery
plan. The documents define the MVP baseline. They intentionally prefer a small portable
contract over features that depend on cache-store internals.

## Status legend

| Status   | Meaning                                                 |
| -------- | ------------------------------------------------------- |
| Planned  | Scope is documented but implementation has not started. |
| Active   | The iteration is being implemented.                     |
| Complete | Acceptance criteria and exit evidence are satisfied.    |
| Blocked  | A recorded dependency or decision prevents completion.  |

## Delivery order

| Iteration                                  | Status   | Outcome                                                        |
| ------------------------------------------ | -------- | -------------------------------------------------------------- |
| [00](00-scope-and-decisions.md)            | Complete | Freeze the MVP contract and decision boundaries.               |
| [01](01-project-foundation.md)             | Complete | Establish the package, toolchain, CI, and distributable build. |
| [02](02-typed-policy-api.md)               | Complete | Define the public, strongly typed policy API.                  |
| [03](03-cache-key-contracts.md)            | Complete | Make keys and TTL deterministic, safe contracts.               |
| [04](04-runtime-cache-aside-proxy.md)      | Planned  | Implement the framework-independent cache-aside proxy.         |
| [05](05-nestjs-provider-integration.md)    | Planned  | Register singleton `useClass` providers transparently.         |
| [06](06-dynamic-modules.md)                | Planned  | Compose root and feature dynamic modules.                      |
| [07](07-mutation-cache-effects.md)         | Planned  | Add source-first exact invalidation and write-through.         |
| [08](08-resilience-and-value-semantics.md) | Planned  | Define fail-open behavior and unambiguous cached values.       |
| [09](09-testing-public-api.md)             | Planned  | Publish deterministic cache contract testing utilities.        |
| [10](10-backend-compatibility.md)          | Planned  | Verify memory and one Redis/Keyv configuration.                |
| [11](11-release-readiness.md)              | Planned  | Complete packaging, documentation, and release evidence.       |

Post-MVP candidates are ordered in the [roadmap](roadmap.md). Their APIs are deliberately
not designed by this plan.

## Global Definition of Done

An iteration is complete only when:

- its acceptance criteria pass on every applicable supported runtime
- public behavior is covered by tests at the lowest useful level
- type-level promises have positive and negative compile-time tests
- exported API and generated declarations contain no accidental internals
- errors and validation messages do not disclose raw keys or cached values
- documentation and examples describe shipped behavior only
- lint, formatting, typecheck, unit tests, integration tests, and build pass
- the recorded exit evidence identifies commands, versions, and notable limitations
- no deferred feature is partially exposed through an unstable public API

## Traceability matrix

| Architecture requirement                                       | Delivery iteration  |
| -------------------------------------------------------------- | ------------------- |
| Transparent providers and cache-agnostic consumers             | 00, 04, 05, 06      |
| `cachedProvider`, `defineCachePolicy`, `forRoot`, `forFeature` | 02, 05, 06          |
| Promise-only configured methods and passthrough                | 00, 02, 04          |
| Runtime tokens, singleton scope, `useClass` ownership          | 00, 05              |
| Explicit resources, typed method inference                     | 02                  |
| Deterministic structured keys, namespace, version              | 03                  |
| Tenant isolation and sensitive key guidance                    | 03, 11              |
| TTL in milliseconds                                            | 00, 03, 10          |
| Cache-aside and preserved provider semantics                   | 04                  |
| Exact-key invalidation and write-through                       | 07                  |
| Source-first mutation effects                                  | 07                  |
| Miss, `null`, falsy values, and `undefined`                    | 08                  |
| Fail-open cache operations and provider error propagation      | 04, 08              |
| Minimal safe cache error reporting                             | 08                  |
| `CACHE_MANAGER` integration and centralized composition        | 05, 06              |
| Static clean-architecture dependency validation                | 06                  |
| Contract testing utilities                                     | 03, 09              |
| Memory and Redis/Keyv compatibility                            | 10                  |
| NestJS 11/12 and Node 20/22/24 compatibility                   | 01, 10, 11          |
| Package exports, declarations, docs, and release checks        | 01, 11              |
| Concurrency, transactions, and distributed limitations         | 00, 07, 11, roadmap |

## Change control

A change that affects a public type, key representation, value envelope, ordering of
cache effects, supported runtime, or failure semantics requires an explicit architecture
decision before implementation. Local implementation details may evolve inside an
iteration when they preserve these contracts.
