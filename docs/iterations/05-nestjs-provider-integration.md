# Iteration 05: NestJS Provider Integration

## Context and motivation

The product becomes useful when a consumer can inject its original token while NestJS
constructs the concrete implementation and transparently publishes the cache proxy.

## Objective

Implement `cachedProvider` for singleton `useClass` registrations using an internal
implementation token and NestJS `CACHE_MANAGER`.

## Architectural decisions

- `cachedProvider` returns the provider definitions needed by `forFeature`; it is not an
  alternative registration model with different behavior.
- Every registration creates a unique internal symbol for the implementation.
- The public token is provided only by a factory that receives the concrete instance,
  cache manager, global options, and compiled policy.
- Supported public tokens are classes, abstract classes, strings, and symbols.
- The implementation class must be singleton-scoped. Request/transient scope is rejected
  before application startup where metadata permits.
- `provide === useClass` is valid because the concrete class is rebound internally; direct
  self-injection of the public token remains a real cycle and is reported by NestJS.
- The proxy is not required to satisfy `instanceof useClass`.

## Functional scope

- Register a cached implementation without modifying implementation or consumer.
- Resolve constructor dependencies through NestJS normally.
- Inject the same public token from consumers and receive the proxy.
- Export the public token from the feature module.

## Technical scope

- Typed NestJS registration descriptor.
- Internal implementation token creation and provider factory.
- Injection of `CACHE_MANAGER` and root options token.
- Startup validation for token, scope, policy, and duplicate registration defects that can
  be detected locally.

## Expected files and components

- `src/nest/cached-provider.ts`
- `src/nest/cache-proxy.tokens.ts`
- `src/nest/cache-proxy-options.ts`
- `src/nest/validate-registration.ts`
- Nest testing-module fixtures

## Detailed steps

1. Define runtime token and `useClass` constructor types.
2. Generate a collision-free internal implementation token per registration.
3. Register `useClass` under that internal token.
4. Register the public-token factory and create the runtime proxy.
5. Wire global options and `CACHE_MANAGER` without configuring a backend.
6. Validate unsupported scopes and malformed or duplicate local registrations.
7. Verify dependency resolution and provider lifecycle hooks.

## Tests

- Nest integration tests for class, abstract-class, string, and symbol public tokens.
- Constructor dependency and lifecycle tests for the concrete implementation.
- Tests proving consumer and implementation source remain cache-agnostic.
- Failure tests for request/transient scope, duplicate tokens, missing root configuration,
  malformed policies, and dependency cycles where diagnostics are controllable.

## Acceptance criteria

- Resolving the public token returns working cached behavior.
- The concrete implementation is constructed once per application context.
- Consumers require no cache import, decorator, or constructor change.
- Registration never injects the public token to construct itself.
- Unsupported scope/configuration fails during bootstrap with actionable redacted output.
- All supported token forms behave identically.

## Definition of Done

The global Definition of Done applies. Tests use real NestJS testing modules rather than
mocking the dependency-injection container.

## Non-goals

- `useExisting`, `useFactory`, or `useValue`
- Request/transient providers
- Automatic discovery or wrapping of existing providers
- Guaranteeing concrete-class reflection identity

## Risks and mitigations

- **Risk:** dynamic provider arrays are awkward to consume directly. **Mitigation:** keep
  `cachedProvider` composable and make `forFeature` the primary application UX.
- **Risk:** scope metadata is incomplete for custom providers. **Mitigation:** validate what
  is knowable and document NestJS bootstrap errors for the remainder.
- **Risk:** duplicate public tokens across modules are ambiguous. **Mitigation:** reject
  duplicates within one feature and define cross-module composition in iteration 06.

## Dependencies

- Iteration 04
- Compatible NestJS/cache-manager foundation from iteration 01

## Documentation updates

Add registration examples for each token category, singleton limitation, lifecycle
behavior, and troubleshooting for cycles and duplicate tokens.

## Exit evidence

- Nest testing-module integration report
- Provider construction/lifecycle assertions
- Token compatibility matrix
- Reviewed bootstrap validation messages
