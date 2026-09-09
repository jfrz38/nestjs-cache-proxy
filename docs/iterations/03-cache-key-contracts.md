# Iteration 03: Cache Key Contracts

## Context and motivation

Keys can outlive a process and cross deployments. Ambiguous encoding, omitted tenant
identity, or accidental representation changes can return incorrect data and become a
security boundary failure.

## Objective

Define and implement a deterministic, backend-independent key contract and strict TTL
validation that policies and tests can inspect without accessing cache internals.

## Architectural decisions

- Final keys contain configured namespace, resource name, resource version, and canonical
  structured input using an unambiguous format.
- MVP structured values are JSON-like primitives, arrays, and plain string-keyed objects;
  finite numbers only. Object keys are sorted recursively.
- `undefined`, functions, symbols, `BigInt`, `Date`, `Map`, `Set`, class instances, sparse
  arrays, non-finite numbers, and cyclic values are rejected.
- Delimiters and type identity are encoded so concatenation cannot create collisions.
- TTL is a positive safe integer in milliseconds. `0`, negative, fractional, `NaN`, and
  infinite values are invalid.
- Raw keys are not included in default logs/errors. Hashing sensitive components remains
  future work; users must avoid placing secrets in key input.

## Functional scope

- Build the same final key for semantically identical supported input.
- Isolate resources, versions, applications, environments, and tenants when configured.
- Expose a pure key builder suitable for contract tests.
- Validate key input and TTL before cache access.

## Technical scope

- `StructuredKeyInput` public type and matching runtime guards.
- Canonical encoder with documented format/version.
- Namespace normalization and final-key composition.
- Contract fixtures for ordering, escaping, primitive distinctions, and rejection cases.

## Expected files and components

- `src/key/structured-key.types.ts`
- `src/key/canonicalize-key.ts`
- `src/key/build-cache-key.ts`
- `src/key/validate-key-input.ts`
- `src/policy/validate-ttl.ts`
- key contract fixtures and tests

## Detailed steps

1. Specify the accepted value grammar and final-key format before coding.
2. Implement canonical encoding recursively with cycle and plain-object checks.
3. Compose namespace, resource, and version without delimiter ambiguity.
4. Validate namespace/resource constraints and TTL.
5. Add public pure helpers needed for policy contract tests.
6. Create frozen fixtures that make format changes deliberate.
7. Verify tenant examples and redaction behavior.

## Tests

- Compile-time tests for accepted and rejected `StructuredKeyInput` shapes.
- Unit property/table tests for object order, arrays, escaping, primitive distinctions,
  cycles, unsupported instances, and TTL boundaries.
- Contract fixtures asserting exact output for representative keys.
- Collision corpus proving known ambiguous concatenations remain distinct.

## Acceptance criteria

- Equivalent plain objects produce byte-identical keys regardless of insertion order.
- Distinct supported structures in the collision corpus never share a key.
- Unsupported values fail before calling the cache or provider.
- Namespace and version changes isolate entries predictably.
- A version bump is documented as isolation, not migration or cleanup.
- Tests demonstrate tenant identity inclusion for tenant-scoped data.

## Definition of Done

The global Definition of Done applies. Any later format change must update fixtures and
explain whether it requires a resource version bump.

## Non-goals

- General object serialization
- Automatic hashing of sensitive values
- Key prefix scans or reverse lookup
- Backward-compatible migration of old key formats

## Risks and mitigations

- **Risk:** users need unsupported domain values. **Mitigation:** require policies to map
  them explicitly to supported primitives; study custom serializers post-MVP.
- **Risk:** long keys affect stores. **Mitigation:** document backend limits and measure
  representative keys in iteration 10 without adding premature hashing.
- **Risk:** namespace omission causes environment collision. **Mitigation:** validate and
  prominently document global namespace composition.

## Dependencies

- Iteration 02

## Documentation updates

Publish the accepted value table, exact format stability rules, TTL units, multi-tenant
guidance, sensitive-data warning, and version-bump checklist.

## Exit evidence

- Canonical format specification
- Frozen key fixture output
- Collision and rejection test report
- Reviewed tenant-isolation example
