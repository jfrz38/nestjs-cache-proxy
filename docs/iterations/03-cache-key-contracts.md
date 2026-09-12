# Iteration 03: Cache Key Contracts

## Context and motivation

Keys can outlive a process and cross deployments. Ambiguous encoding, omitted tenant
identity, or accidental representation changes can return incorrect data and become a
security boundary failure.

## Objective

Define and implement a deterministic, backend-independent key contract and strict TTL
validation that policies and tests can inspect without accessing cache internals.

## Architectural decisions

- Final keys use `ncp:k1:` followed by a fixed-order JSON payload containing namespace,
  resource name, resource version, and canonical structured input.
- MVP structured values are JSON-like primitives, arrays, and plain string-keyed objects;
  finite numbers only. Object keys are sorted recursively.
- `undefined`, functions, symbols and symbol properties, `BigInt`, `Date`, `Map`, `Set`, class
  instances, accessors, non-enumerable properties, sparse arrays, non-finite numbers, and
  cyclic values are rejected. Objects with `Object.prototype` or `null` prototype are allowed.
- Delimiters and type identity are encoded so concatenation cannot create collisions.
- TTL is a positive safe integer in milliseconds. `0`, negative, fractional, `NaN`, and
  infinite values are invalid.
- Raw keys are not included in default logs/errors. Hashing sensitive components remains
  future work; users must avoid placing secrets in key input.
- Namespace components and resource names are non-empty strings without Unicode normalization.
  Their literal values remain distinct identities.
- Validation errors extend `CacheKeyValidationError`; namespace, resource, version, and input
  failures each expose a stable specialized error class and code without raw key input.

## Frozen `k1` format

`buildCacheKey` accepts `{ namespace: { application, environment }, resource, version, input }`.
All strings must be non-empty after trimming; `version` is a positive safe integer. The output
is exactly the `ncp:k1:` prefix plus this fixed-order JSON form:

```text
{"input":<tagged-input>,"namespace":{"application":"...","environment":"..."},"resource":"...","version":1}
```

Tagged input values use `{"t":"null"}`, `{"t":"boolean","v":true}`,
`{"t":"string","v":"..."}`, `{"t":"number","v":"..."}`,
`{"t":"array","v":[...]}`, and `{"t":"object","v":[[key,value],...]}`. Numbers are
canonical strings and preserve `-0`; object entries sort by UTF-16 code-unit order. The exact
field order and tags are part of format `k1`. A representation change needs a new format prefix;
a resource-version bump isolates changed resource semantics but does not migrate or delete data.

## Functional scope

- Build the same final key for semantically identical supported input.
- Isolate resources, versions, applications, environments, and tenants when configured.
- Expose a pure key builder suitable for contract tests.
- Validate key input and TTL before cache access.

## Technical scope

- Runtime guards for the existing public `StructuredKeyInput` type.
- Canonical encoder with documented format/version.
- Fixed namespace validation and final-key composition.
- Contract fixtures for ordering, escaping, primitive distinctions, and rejection cases.

## Expected files and components

- `src/domain/key/structured-key.types.ts` (introduced in iteration 02; extended only if needed)
- `src/domain/key/canonicalize-key.ts`
- `src/domain/key/build-cache-key.ts`
- `src/domain/key/cache-key-validation-error.ts`
- `src/domain/key/encode-structured-key-input.ts`
- `src/domain/policy/validate-ttl.ts`
- key contract fixtures and tests

## Detailed steps

1. Specify the accepted value grammar and final-key format before coding.
2. Implement canonical encoding recursively with cycle and plain-object checks.
3. Compose namespace, resource, and version without delimiter ambiguity.
4. Validate namespace/resource constraints and centralize TTL validation.
5. Add public pure helpers needed for policy contract tests.
6. Create frozen fixtures that make format changes deliberate.
7. Verify tenant examples and redaction behavior.

## Tests

- Compile-time tests for accepted and rejected `StructuredKeyInput` shapes.
- Unit property/table tests for object order, arrays, escaping, primitive distinctions,
  cycles, unsupported instances, and TTL boundaries.
- Frozen exact-output fixtures for representative keys.
- Collision corpus proving known ambiguous concatenations remain distinct.
- Runtime tests for specialized validation-error hierarchy, names, codes, and redaction.

## Acceptance criteria

- Equivalent plain objects produce byte-identical keys regardless of insertion order.
- Distinct supported structures in the collision corpus never share a key.
- Unsupported values fail before calling the cache or provider.
- Namespace and version changes isolate entries predictably.
- A version bump is documented as isolation, not migration or cleanup.
- Tests demonstrate tenant identity inclusion for tenant-scoped data.
- Consumers can distinguish namespace, resource, version, and input validation failures through
  specialized errors while handling their shared base class.

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

Publish the accepted value table, exact format stability rules, validation-error hierarchy, TTL
units, multi-tenant guidance, sensitive-data warning, and version-bump checklist.

## Exit evidence

- `pnpm run typecheck` validates public key input types and policy typing.
- `pnpm run test` covers frozen `k1` output, collision pairs, rejection cases, TTL boundaries,
  namespace/resource/version isolation, and package exports.
- The root README documents tenant identity, sensitive-input guidance, format stability, and
  version-bump behavior.
