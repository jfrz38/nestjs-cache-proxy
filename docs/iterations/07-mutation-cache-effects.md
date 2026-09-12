# Iteration 07: Mutation Cache Effects

## Context and motivation

Cache-aside reads become stale after mutations. Portable correction is possible only when
the policy can derive each exact affected key or target a single constant-key resource.

## Objective

Execute typed, ordered exact invalidation and write-through effects after successful
provider mutations without overstating consistency guarantees.

## Architectural decisions

- The source-of-truth mutation always completes before any cache effect begins.
- If the provider throws or rejects, no delete or write-through operation runs.
- Effects execute sequentially in declaration order for deterministic behavior.
- Each invalidation supplies a resource and derives that resource's key arguments from the
  mutation `args` and awaited `result`.
- Constant-key resources may omit derivation only when their key takes no arguments.
- Write-through is valid only when policy code supplies the complete canonical value for
  the target read resource.
- Cache effect failures fail open and do not change the successful provider result.
- Races can repopulate stale data; transaction rollback can invalidate too early. The MVP
  offers no atomicity, locking, generation, or post-commit integration.

## Functional scope

- Delete one or more exact cache entries after a successful mutation.
- Write a mutation result or explicit projection to an exact cache entry.
- Compose invalidation and write-through in an explicit deterministic sequence.
- Return the original provider result regardless of cache-effect success.

## Technical scope

- Runtime effect compiler and executor.
- Typed effect contexts and exact key integration.
- Fail-open operation reporting seam.
- Call-order and race documentation.
- Introduce `ValidatedCachePolicy.create()` and internal validated effect models so the runtime
  compiler consumes policy structure already checked by the specialized validators.

## Expected files and components

- `src/application/runtime/execute-mutation.ts`
- `src/application/runtime/execute-cache-effects.ts`
- `src/application/runtime/compiled-policy.types.ts`
- mutation provider fixtures and ordered cache spy

## Detailed steps

1. Compile public mutation rules into ordered runtime effects.
2. Await the provider mutation before evaluating result-dependent builders.
3. Derive and validate every exact target key.
4. Execute delete and write-through sequentially.
5. Route each cache failure to the error reporting seam and continue safely.
6. Preserve the exact provider result and rejection semantics.
7. Add examples for entity update, query invalidation, and constant-list invalidation.
8. Make the runtime compiler consume `ValidatedCachePolicy` rather than reinterpreting raw policy
   input.

## Tests

- Unit tests for provider-before-cache ordering and no effects after failure.
- Exact derivation tests using args, result, multiple effects, and constant resources.
- Mixed invalidate/write-through order tests.
- Fail-open tests for every delete/set position in a sequence.
- Concurrency fixture demonstrating and documenting the permitted stale-repopulation race.

## Acceptance criteria

- No cache mutation occurs before source-of-truth success.
- Every deletion maps to one deterministic full key; no scan/prefix API is invoked.
- Multiple effects run in documented order even when a prior cache effect fails.
- Write-through stores only the explicitly projected canonical value.
- The provider result/error remains authoritative.
- Limitations for concurrent reads and transactions are prominent and tested where useful.

## Definition of Done

The global Definition of Done applies. Mutation examples must not imply resource-wide
dynamic deletion or strong consistency.

## Non-goals

- Prefix deletion, tags, indexes, generations, or backend-specific scans
- Atomic multi-key operations
- Transaction/post-commit awareness
- Refresh calls or event-driven invalidation

## Risks and mitigations

- **Risk:** users omit a query key affected by a mutation. **Mitigation:** make effects
  explicit, testable contracts and document domain ownership of invalidation policy.
- **Risk:** write-through uses a partial mutation response. **Mitigation:** require an
  explicit value function and explain canonical-value responsibility.
- **Risk:** fail-open deletion leaves stale data. **Mitigation:** report the operation
  safely and recommend bounded TTLs; stronger mechanisms remain roadmap work.

## Dependencies

- Iteration 04 runtime
- Iteration 02 policy types
- Iteration 03 keys

## Documentation updates

Document effect syntax, execution order, exact-key requirement, constant-resource case,
write-through suitability, races, transaction rollback, and recovery through TTL.

## Exit evidence

- Ordered-effect unit test report
- Exact-key derivation fixtures
- Failure matrix for provider/delete/set operations
- Reviewed concurrency and transaction limitation text
