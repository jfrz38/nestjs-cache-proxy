# Iteration 09: Testing Public API

**Status:** Complete

## Context and motivation

Keys and mutation effects are application contracts. Users need deterministic tests that
do not depend on private cache-manager adapters or Redis inspection commands.

## Objective

Publish a small testing entry point for deterministic cache behavior, key inspection, and
policy contract assertions.

## Architectural decisions

- Testing utilities are public, versioned API under a separate package export.
- A deterministic in-memory test cache implements only supported cache operations and TTL.
- Tests use an injected clock rather than real sleeping.
- Inspection returns safe structured records in test code; production cache-event hooks remain
  redacted. Documentation warns against using sensitive values even in test keys.
- Assertions focus on observable contracts: final keys, TTL, hit/miss, writes, deletes,
  and provider calls.
- Utilities do not expose runtime internals or emulate Redis-specific behavior.

## Functional scope

- Create/reset a test cache and advance deterministic time.
- Inspect cache operations and currently live entries.
- Build expected keys from public policy/resource inputs.
- Build typed expected keys from policy resources and their method arguments.

## Technical scope

- Separate `testing` export and declarations.
- Clock abstraction and deterministic expiration.
- Operation log with typed get/set/delete records.
- Typed `buildPolicyCacheKey` helper; assertions remain in the consumer's test runner.

## Expected files and components

- `src/testing/create-test-cache.ts`
- `src/testing/test-clock.ts`
- `src/testing/cache-contract.ts`
- `src/testing/index.ts`
- package export map updates
- self-tests and consumer fixtures

## Detailed steps

1. Define a `createTestCache()` controller with a typed cache-manager operation subset.
2. Implement a monotonic manual clock, exact TTL expiry, reset, and hit seeding without sleeps.
3. Record immutable logical-value operation and live-entry snapshots.
4. Reuse the production key builder through typed policy/resource argument inputs.
5. Export independent ESM, CommonJS, and declaration entry points under `./testing`.
6. Use the public fake in the Nest module integration test and packed consumers.

## Tests

- Unit tests for expiry boundaries, reset, operation ordering, overwrites, and inspection.
- Unit tests for hit seeding, cached `null` and falsy values, `undefined`, and snapshot isolation.
- Type tests for the testing entry point.
- Packed consumer test importing `nestjs-cache-proxy/testing`.

## Acceptance criteria

- Tests never need real-time sleeps to verify TTL.
- Users can assert exact keys and cache effects without private imports.
- Test-cache semantics match the documented MVP cache contract.
- The testing entry point has independent declarations and no Nest application requirement.
- The production package entry point does not accidentally export test-only implementation
  details.

## Definition of Done

The global Definition of Done applies. At least the library's own core contract suite uses
the same public helpers offered to consumers.

## Non-goals

- Full cache-manager or Redis emulator
- Network fault simulation framework
- Custom Vitest matcher package
- Contract snapshots CLI or CI service

## Risks and mitigations

- **Risk:** the fake diverges from real stores. **Mitigation:** keep it deliberately small
  and run the same behavioral suite against real backends in iteration 10.
- **Risk:** helpers couple users to internals. **Mitigation:** expose only architecture-level
  behavior and test the separate declaration surface.
- **Risk:** operation logs retain sensitive test data. **Mitigation:** document test-only
  scope and discourage production use/export.

## Dependencies

- Iterations 03, 07, and 08

## Documentation updates

Add a testing guide with fake-clock examples, key contract assertions, behavior tests,
reset rules, and the boundary between deterministic fake and backend compatibility tests.

## Exit evidence

- Public testing API declaration review through `pnpm run typecheck`.
- Self-hosted Nest module integration uses `createTestCache()` without internal cache doubles.
- TTL boundary tests advance the manual clock with no real-time sleeps.
- `pnpm run pack:check` imports `nestjs-cache-proxy/testing` from ESM, CommonJS, and TypeScript
  consumers.
