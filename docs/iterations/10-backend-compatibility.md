# Iteration 10: Backend Compatibility

**Status:** Active

## Context and motivation

Backend independence is a behavioral claim, not an assumption. Memory and distributed
Keyv stores can differ in miss values, TTL, serialization, and failure behavior.

## Objective

Run one behavioral contract suite against memory and one officially documented Redis/Keyv
configuration across supported NestJS and Node majors.

## Architectural decisions

- The application owns cache-manager and store configuration through NestJS `CacheModule`.
- The official distributed setup is one pinned, reproducible Redis/Keyv adapter combination.
- Compatibility claims list exact tested versions and dates; peer ranges widen only after
  the matrix passes.
- Behavioral parity covers library contracts, not every backend administration feature.
- Redis tests use an ephemeral service/container in CI and must not depend on developer
  machine state.
- Local Redis tests use a pinned Docker image and always remove their own container.
- The compatibility matrix runs NestJS 11 and 12 on Node 20, 22, and 24, for six
  backend-contract jobs.
- Backend differences that cannot be normalized are documented rather than hidden.

## Functional scope

- Verify cache-aside, TTL, values, exact invalidation, write-through, and fail-open behavior
  against both stores.
- Verify real NestJS repository-provider and use-case-provider examples.
- Verify NestJS 11 and 12 and applicable Node 20, 22, and 24 combinations.

## Technical scope

- Shared backend contract suite parameterized by cache manager factory.
- Memory and Redis/Keyv fixtures with deterministic isolation/cleanup.
- Compatibility matrix CI jobs separated from fast unit jobs.
- Version report generated or recorded from lockfiles and runtime output.

## Expected files and components

- `test/contract/cache-backend.contract.ts`
- `test/integration/memory/`
- `test/integration/redis/`
- `code/scripts/run-redis-contract.mjs`
- repository and use-case example fixtures
- CI Redis service/container configuration
- compatibility documentation

## Detailed steps

1. Select versions compatible with the Node floor and both NestJS target majors.
2. Build a shared suite from public behavior, not adapter internals.
3. Run it against the supported memory configuration.
4. Add an isolated Redis/Keyv setup and run the identical suite.
5. Test TTL with bounded eventual timing appropriate for the real backend.
6. Exercise provider and use-case composition through real Nest modules.
7. Populate a matrix of passing combinations and known store differences.
8. Adjust peer ranges only to the evidence produced.
9. Record the runtime and dependency versions printed by every compatibility job.

## Tests

- Contract: hit/miss, values including `null`, expiry, exact delete, write-through, malformed
  entries where injectable, and operation failures where safely reproducible.
- Integration: `forRoot`, `forFeature`, centralized module, repository, and use case.
- Matrix: NestJS 11/12 with supported cache-manager/Keyv and Node 20/22/24 combinations.
- Isolation: parallel runs cannot share keys or Redis state.

## Acceptance criteria

- The same behavioral suite passes against memory and the documented Redis setup.
- Every claimed NestJS/Node combination has CI evidence.
- TTL units and miss/value semantics are identical at the library boundary.
- Local Redis verification requires Docker but never a pre-existing Redis instance.
- Tests clean up resources and do not require a pre-existing local Redis instance.
- Documentation includes exact versions, setup, differences, and troubleshooting.
- Peer dependency ranges do not exceed verified compatibility without explicit rationale.

## Definition of Done

The global Definition of Done applies. A failed compatibility job blocks release even when
unit tests pass.

## Non-goals

- Certifying every Keyv adapter or Redis topology
- Redis cluster, sentinel, TLS, or production operations guidance
- Performance/load benchmarks or latency SLOs
- L1/L2 and distributed invalidation

## Risks and mitigations

- **Risk:** full Cartesian matrices are expensive. **Mitigation:** choose representative
  dependency combinations while covering every claimed major and runtime.
- **Risk:** TTL tests are flaky. **Mitigation:** use generous bounded polling only in real
  backend tests and deterministic clocks everywhere else.
- **Risk:** adapter releases regress behavior. **Mitigation:** lock CI fixtures and use
  scheduled dependency updates with the same suite.

## Dependencies

- Iterations 06 through 09

## Documentation updates

Publish the verified compatibility table, official memory and Redis configurations,
backend limitations, Node engine floor, and distinction between peer range and tested set.

## Exit evidence

- CI matrix links and exact version report
- Shared contract-suite results for both backends
- Repository/use-case integration results
- Redis setup and cleanup transcript
