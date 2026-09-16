# Iteration 08: Resilience and Value Semantics

## Status

Complete

## Context and motivation

Cache stores disagree on miss representation and serialization details. At the same time,
cache outages must not make the provider unavailable or silently hide operational faults.

## Objective

Finalize an unambiguous stored-value envelope and per-operation fail-open behavior with a
minimal safe cache-event contract.

## Architectural decisions

- Every stored value uses an internal envelope with a library marker, envelope version,
  and payload. Backend `undefined` or `null` means miss unless a valid envelope is present.
- `null`, `false`, `0`, and empty strings are cacheable values. `undefined` is never stored.
- Unknown or malformed envelopes are treated as cache read failures followed by provider
  fallback, not as user values.
- The envelope is internal and may evolve only with compatibility tests; resource versions
  isolate user representation changes but are not a substitute for envelope compatibility.
- Get failure behaves as miss. Set/delete failure does not change a successful provider
  response. Provider failure always propagates.
- A synchronous or asynchronous user event hook is isolated: its failure is swallowed and
  cannot change provider behavior.
- Cache events contain operation, outcome, resource identifier, and a sanitized cause only for
  errors; they contain no raw key, args, result, or cached payload.
- The public error cause is a fresh `CacheOperationError` with a fixed message. The original
  backend error is deliberately not exposed because it can include raw cache keys or values.
- The MVP adds no cache-operation timeout; a slow cache can still delay a call.

## Functional scope

- Correctly round-trip supported values through memory and distributed stores.
- Distinguish miss from cached `null` without store-specific assumptions.
- Continue provider execution during cache failures.
- Let applications observe cache outcomes safely through root configuration.

## Technical scope

- Envelope encoder/decoder and validation.
- Central get/set/delete wrappers implementing fail-open rules.
- Minimal `onCacheEvent` public option and redacted event type.
- Integration into read and mutation execution paths.

## Expected files and components

- `src/application/runtime/cache-envelope.ts`
- `src/application/runtime/cache-operations.ts`
- `src/application/runtime/cache-event.ts`
- `src/infrastructure/nest/cache-event-hook-reporter.ts`
- updates to root options and runtime proxy
- malformed-store and event-hook fixtures

## Detailed steps

1. Specify the envelope format and compatibility rule.
2. Encode eligible values and decode only validated envelopes.
3. Centralize get, set, and delete error handling.
4. Define and invoke a non-blocking-by-contract event hook while safely awaiting a returned
   promise if necessary to avoid unhandled rejection.
5. Redact key material and values from events and validation errors.
6. Apply the wrappers to cache-aside and mutation effects.
7. Test store-specific miss values and malformed payloads.

## Implementation plan

1. Encode every defined value as `{ marker, version, payload }` and recognize only marker
   `nestjs-cache-proxy` at envelope version `1`.
2. Treat backend `undefined` and `null` as misses; report any other non-envelope value as a
   safe `get` failure without deleting it.
3. Route all get, set, and delete calls through a runtime operation boundary that owns
   fail-open handling, envelope conversion, and reporter isolation.
4. Preserve source-first ordered mutation effects while routing write-through through the
   same set operation; an `undefined` write-through projection is skipped.
5. Thread an optional `onCacheEvent` callback from `forRoot` into the Nest composition root.
6. Await callback promises only to contain their rejection; callback latency is not bounded
   in this MVP and callback failures are swallowed.

## Tests

- Unit round trips for `null`, false, zero, empty string, objects, arrays, and `undefined`.
- Failure matrix for get, set, delete, malformed envelope, hook throw, and hook rejection.
- Assertions that provider rejection identity/stack is preserved.
- Security tests proving events do not include key input, raw key, args, or values.
- Backend contract tests are repeated in iteration 10.

## Acceptance criteria

- A cached `null` is a hit and does not execute the provider.
- `undefined` causes no set and is recomputed on the next call.
- Every cache-operation failure follows documented fail-open behavior.
- Every provider failure propagates unchanged.
- Event-hook failure never affects the provider call and creates no unhandled rejection.
- Malformed cache data cannot be returned as a provider result.

## Definition of Done

The global Definition of Done applies. The envelope format and redaction contract are
reviewed as persistence and security boundaries.

## Non-goals

- Configurable serializers/revivers
- Negative-cache policy or separate negative TTL
- Cache-operation timeouts, retries, or circuit breakers
- Metrics, tracing, and full event streams

## Risks and mitigations

- **Risk:** backend serialization mutates supported payloads. **Mitigation:** define the
  initial supported value boundary and verify it in iteration 10.
- **Risk:** malformed entries cause repeated provider load. **Mitigation:** report safely;
  optional cleanup can be studied without blocking fail-open fallback.
- **Risk:** synchronous hooks add latency. **Mitigation:** keep payload minimal and document
  that handlers must be fast; richer observability is post-MVP.

## Dependencies

- Iteration 04
- Iteration 07

## Documentation updates

Publish the value table, envelope compatibility policy, operation failure matrix, hook
payload/redaction rules, and lack of timeout protection.

## Exit evidence

- Envelope version `1` round-trips `null`, falsy primitives, objects, and arrays; `undefined`
  is omitted. Unknown versions, markers, incomplete envelopes, and raw values are malformed
  cache reads and fall back without cleanup.
- Runtime and Nest integration tests cover get, set, delete, malformed values, hook rejection,
  sanitized causes, source error propagation, and `undefined` write-through omission.
- `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, `pnpm run build`, and
  `pnpm run pack:check` passed from `code/` on Node 24 and pnpm 12.3.4.
- `pnpm run format:check` remains red on the pre-existing formatting debt in unchanged files;
  all files introduced or modified by this iteration were formatted with Prettier.
