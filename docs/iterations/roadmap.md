# Post-MVP Roadmap

This roadmap orders candidate capabilities after the MVP. Each item requires further
study before its API, guarantees, backend requirements, and delivery iterations are
approved. Ordering expresses dependency and learning value, not a release commitment.

## Evaluation rule

For every candidate, first identify the concrete user problem, verify that composition or
an existing dependency does not already solve it, and compare the benefit with added
state, coupling, operational cost, and migration risk. No roadmap item may weaken the MVP
invariants of transparent providers, source-first mutations, explicit key contracts,
provider error propagation, and backend-honest behavior.

## 1. `useExisting` provider ownership

**Rationale:** wraps an implementation owned and exported by another module while
preserving its existing instance.

**Dependencies:** module visibility rules, scope detection, duplicate-token semantics,
cycle diagnostics, and realistic NestJS fixtures.

**Risks:** private providers are not discoverable, `provide === useExisting` can recurse,
and cross-module token collisions are difficult to diagnose.

**Status:** requires further study.

## 2. Negative caching

**Rationale:** reduces repeated source calls for known absent values.

**Dependencies:** value envelope, explicit opt-in, separate TTL, and definition of which
results count as negative.

**Risks:** delayed visibility after creation, authorization-sensitive absence, and excess
staleness.

**Status:** requires further study.

## 3. Cache operation timeouts

**Rationale:** fail-open is ineffective against a cache call that never returns promptly.

**Dependencies:** cancellation semantics, per-operation defaults, timer cleanup, and store
behavior after caller timeout.

**Risks:** abandoned operations still mutate cache, timer overhead, and surprising latency
budgets.

**Status:** requires further study.

## 4. Request coalescing

**Rationale:** prevents many concurrent misses for one key from duplicating source work.

**Dependencies:** in-flight lifecycle, error fan-out, timeout/cancellation policy, and
process-local versus distributed scope.

**Risks:** memory leaks, head-of-line blocking, and cross-request context contamination.

**Status:** requires further study.

## 5. TTL jitter

**Rationale:** spreads expirations and reduces synchronized source load.

**Dependencies:** deterministic test hooks, bounds, rounding, and interaction with negative
TTL.

**Risks:** less predictable expiry and accidentally exceeding freshness limits.

**Status:** requires further study.

## 6. Serialization hooks

**Rationale:** supports dates, value objects, and representations not preserved by the
official backend serializer.

**Dependencies:** serializer identity/versioning, error behavior, security review, and
resource compatibility rules.

**Risks:** code execution surfaces, incompatible rolling deployments, and double encoding.

**Status:** requires further study.

## 7. Metrics, events, and OpenTelemetry

**Rationale:** provides hit rate, latency, errors, and operation traces beyond the minimal
MVP error hook.

**Dependencies:** stable event taxonomy, cardinality controls, redaction, optional peers,
and near-zero disabled overhead.

**Risks:** raw key leakage, high-cardinality costs, and framework coupling.

**Status:** requires further study.

## 8. Explicit cache bypass context

**Rationale:** enables administrative, repair, debugging, or request-specific fresh reads
without changing provider methods.

**Dependencies:** async context propagation, nested call semantics, and interaction with
write-through/coalescing.

**Risks:** context leakage and consumers becoming cache-aware.

**Status:** requires further study.

## 9. Reusable and injectable policies

**Rationale:** shares conventions across large applications and permits configuration from
DI when plain objects are insufficient.

**Dependencies:** composition/override rules, lifecycle, asynchronous configuration, and
type inference preservation.

**Risks:** policy inheritance complexity and boilerplate that undermines simple inline UX.

**Status:** requires further study.

## 10. Tags or indexed invalidation

**Rationale:** invalidates all dynamic query entries affected by a mutation without
backend-specific prefix scanning.

**Dependencies:** index data model, atomic updates, cleanup, TTL alignment, concurrency,
and backend capability contract.

**Risks:** stale indexes, unbounded metadata, partial failures, and distributed races.

**Status:** requires further study.

## 11. L1/L2 caching

**Rationale:** combines process-local latency with shared distributed capacity.

**Dependencies:** tier selection, promotion, TTL coordination, invalidation propagation,
and observability.

**Risks:** amplified staleness, complex failure matrices, and memory pressure.

**Status:** requires further study.

## 12. Distributed invalidation

**Rationale:** propagates cache effects to process-local tiers and multiple instances.

**Dependencies:** tags/indexing or exact-key events, delivery semantics, idempotency,
ordering, reconnect behavior, and operational ownership.

**Risks:** lost/duplicate events and false confidence in consistency.

**Status:** requires further study.

## 13. Stale-while-revalidate

**Rationale:** reduces latency and source load while refreshing popular entries.

**Dependencies:** dual freshness windows, coalescing, background task lifecycle, and error
reporting.

**Risks:** serving stale data outside business tolerance and uncontrolled background work.

**Status:** requires further study.

## 14. Transaction and post-commit integration

**Rationale:** prevents cache effects from preceding transaction commit or surviving
rollback incorrectly.

**Dependencies:** explicit transaction context ports, ORM-neutral hooks or adapters, nested
transaction semantics, and failure recovery.

**Risks:** infrastructure coupling and an impossible universal transaction abstraction.

**Status:** requires further study.

## 15. Contract snapshots, CLI, and CI validation

**Rationale:** detects accidental key/policy contract changes across a large codebase.

**Dependencies:** stable manifest format, static or runtime policy discovery, package
boundaries, and baseline storage.

**Risks:** false confidence from incomplete discovery and noisy snapshot churn.

**Status:** requires further study.

## Additional candidates

Circuit breakers, named stores, per-resource tiers, bulk entity decomposition, dependency
graphs, and event-driven invalidation remain unprioritized. They require a demonstrated
problem and the same architecture evaluation before entering this ordered roadmap.
