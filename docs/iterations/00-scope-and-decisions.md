# Iteration 00: Scope and Decisions

## Context and motivation

The architecture describes a broad product direction. Before code exists, the MVP needs
an honest boundary that is implementable over NestJS and cache-manager without depending
on store-specific key enumeration or changing provider contracts.

## Objective

Freeze the MVP invariants, public-behavior boundaries, and deferred decisions so later
iterations do not accidentally expand scope.

## Architectural decisions

- Transparency means provider implementations and consumers do not change; explicit
  policy and module registration are required composition concerns.
- Cache behavior may target only methods returning `Promise<T>`.
- Synchronous methods, Observables, streams, async iterables, and callbacks are passthrough
  only and cannot be configured in the MVP.
- Providers use NestJS default singleton scope. Request and transient scopes are rejected.
- Public tokens must exist at runtime: classes, abstract classes, strings, or symbols.
- `useClass` is the sole MVP ownership model. An internal unique token holds the concrete
  implementation and the public token resolves the proxy.
- `cachedProvider` is the registration primitive used by `forFeature`; there are not two
  independent provider registration semantics.
- Invalidation always derives and deletes exact keys. A constant-key resource is the only
  portable resource-wide special case.
- Mutation effects run after provider success, in declared order. They are best-effort and
  do not promise strong consistency under races or transaction rollback.
- TTL is a positive integer in milliseconds.
- The package publishes ESM and CommonJS entry points with matching declarations, subject
  to validation against the selected build tool in iteration 01.
- Inline policy objects are the primary simple-case UX. Extracted policy files are an
  organizational choice; injectable policy classes are post-MVP.

## Functional scope

This iteration changes documentation only. It defines what future implementation may
claim and what validation must reject.

## Technical scope

- Record the baseline in `docs/architecture.md` and this plan.
- Establish terminology for resource, policy, public token, implementation token, exact
  key, value envelope, cache effect, and passthrough.
- Treat NestJS 11 and 12 as target majors and Node 20, 22, and 24 as the CI matrix.

## Expected files and components

- `docs/architecture.md`
- `docs/iterations/README.md`
- `docs/iterations/00-scope-and-decisions.md`
- Later decision records if implementation invalidates an assumption

## Detailed steps

1. Reconcile the architecture's exploratory examples with the MVP baseline.
2. Mark `useExisting`, refresh, resource-wide dynamic invalidation, policy classes, and
   distributed consistency features as post-MVP.
3. Document method, token, scope, TTL, value, and failure constraints.
4. Establish change-control rules for public contracts.
5. Review every later iteration against these decisions.

## Tests

No runtime tests apply. Documentation validation must check links, headings, and the
presence of every required decision in the traceability matrix.

## Acceptance criteria

- The architecture and iteration plan do not disagree about MVP capabilities.
- Every MVP architecture requirement maps to at least one iteration.
- Every post-MVP item is absent from MVP acceptance criteria.
- No example implies portable prefix scans, transparent synchronous caching, or automatic
  transaction awareness.

## Definition of Done

The global Definition of Done applies. The reviewed decisions are sufficient to begin
package bootstrap without an unresolved product blocker.

## Non-goals

- Designing post-MVP APIs
- Selecting a Redis deployment topology
- Promising strong cache consistency
- Implementing package or runtime code

## Risks and mitigations

- **Risk:** documentation drifts as code evolves. **Mitigation:** release readiness checks
  examples and limitations against integration tests.
- **Risk:** ESM/CommonJS dual output complicates the build. **Mitigation:** validate the
  package shape in iteration 01 and record a decision if one format must be dropped.
- **Risk:** exact invalidation seems less convenient. **Mitigation:** make derivation typed
  and concise; study indexed invalidation separately.

## Dependencies

None.

## Documentation updates

Update the architecture baseline, iteration index, and root README links.

## Exit evidence

- Architecture baseline revised on 2026-09-10 to state the Promise-only, singleton,
  `useClass`, exact-key, millisecond-TTL, envelope, and fail-open constraints.
- All 16 Markdown files present at this stage passed local-link target validation.
- Every iteration contains the required planning sections and the traceability matrix has
  no known MVP requirement gap.
- `git diff --check` passes; CRLF conversion warnings reflect the existing Windows Git
  configuration and are not whitespace errors.
