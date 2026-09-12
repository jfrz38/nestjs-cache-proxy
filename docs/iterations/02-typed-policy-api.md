# Iteration 02: Typed Policy API

## Context and motivation

The policy is the only place where consumers describe cache semantics. It must infer
provider methods, arguments, and results while making unsupported behavior impossible or
obviously invalid before runtime.

## Objective

Publish a minimal `defineCachePolicy<T>()` contract for resources and Promise-returning
method rules, plus the registration types consumed by later NestJS integration.

## Architectural decisions

- Only keys of `T` whose values are functions returning `Promise<unknown>` are configurable.
- Key builders receive the original argument tuple. Mutation effect builders receive a
  typed context containing immutable `args` and awaited `result`.
- Resources are policy-local names and declare the Promise-returning `method` that defines
  their key argument tuple and cached result type.
- A method may declare one cache-aside read rule or ordered mutation effects, not both.
- MVP mutation effects are exact invalidation and write-through. Refresh is not exposed.
- `defineCachePolicy<T>()` is currified and identity-style, preserving inline literal names
  without a class or DI.
- `StructuredKeyInput` is already public; deterministic encoding and runtime validation of
  that value grammar are deferred to iteration 03.
- Runtime validation is structural only. Generic provider methods and Promise return types are
  erased at runtime, so their validation remains a TypeScript and registration concern.
- Conflicts between dynamic write-through and invalidation targets are checked when exact keys
  are derived in iteration 07, not by comparing unevaluated functions here.

## Functional scope

- Declare resources with `method`, `version`, `ttl`, and `key`.
- Configure cache-aside reads.
- Configure ordered exact invalidation and write-through effects.
- Expose types for class, string, and symbol-backed runtime tokens without pretending that
  TypeScript interfaces exist at runtime.

## Technical scope

- Utility types for Promise method names, argument tuples, and awaited results.
- Public JSON-like `StructuredKeyInput` grammar in the `key` module; runtime validation and
  canonical encoding remain deferred to iteration 03.
- Resource-name inference and discriminated method-rule unions.
- Registration type for singleton `useClass` providers.
- Runtime structural validation entry point with actionable, redacted errors.

## Expected files and components

- `src/domain/policy/define-cache-policy.ts`
- `src/domain/policy/policy.types.ts`
- `src/domain/policy/validate-policy.ts`
- `src/domain/key/structured-key.types.ts`
- `src/infrastructure/nest/cached-provider.types.ts`
- `src/index.ts`
- `test/types/policy.test-d.ts` or equivalent compile fixtures

## Detailed steps

1. Define reusable method extraction and `Awaited` result utilities.
2. Define resource records and infer their literal names.
3. Model mutually exclusive read and mutation rules.
4. Type exact-key derivation against the referenced resource's method argument tuple.
5. Type write-through values against the resource's cached result where feasible.
6. Define `defineCachePolicy<T>()` without requiring explicit generic repetition beyond the
   provider contract.
7. Add runtime validation for empty names, unknown resources, invalid TTL/version, malformed
   effects, and contradictory read/mutation rules.
8. Export only stable consumer-facing types.

## Tests

- Compile-time positive fixtures for zero/multiple arguments, `void` mutations, nullable
  results, abstract-class contracts, and inline policies.
- Compile-time negative fixtures for unsupported structured values, invalid effect argument
  tuples, incompatible write-through values, and read/mutation combinations.
- Unit tests for runtime validation paths and redacted messages.

## Acceptance criteria

- Valid policies infer arguments and results without `any` annotations.
- Promise method arguments, results, and configured effect builders retain their inferred
  types without consumer-provided `any` annotations.
- Runtime validation catches invalid JavaScript/untyped input deterministically.
- Simple policies require no policy class, decorator, or provider modification.
- Public declaration snapshots contain understandable names and no private implementation
  types.

## Definition of Done

The global Definition of Done applies. Type tests are required release tests, not examples
that may be skipped by CI.

## Non-goals

- Runtime cache execution
- Injectable or inherited policy classes
- `useExisting`, `useFactory`, or `useValue`
- Overload-perfect inference, sync methods, streams, or Observables

## Risks and mitigations

- **Risk:** clever conditional types harm diagnostics. **Mitigation:** prefer named,
  shallow utility types and test emitted error locations.
- **Risk:** overloaded/index-signature contracts degrade inference. **Mitigation:** document
  the limitation rather than widening to unsafe `any`.
- **Risk:** result compatibility cannot always be proven structurally. **Mitigation:** keep
  runtime validation and integration tests at the registration boundary.

## Dependencies

- Iteration 01

## Documentation updates

Add public API signatures, one inline policy example, extraction guidance for large
policies, and a table of supported/unsupported method shapes.

## Exit evidence

- Positive and negative type-test report: `pnpm run typecheck`
- Generated declaration review: `pnpm run build`
- Unit test report for validation: `pnpm run test`
- Minimal consumer example compiling without casts: root README example
