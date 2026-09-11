# Iteration 04: Runtime Cache-Aside Proxy

## Context and motivation

The runtime behavior should be testable without NestJS so that proxy semantics, provider
calls, and cache interactions remain a small independent core.

## Objective

Implement a framework-independent JavaScript `Proxy` that performs cache-aside for
configured Promise methods and faithfully passes through all other behavior.

## Architectural decisions

- The core depends on a minimal internal cache port shaped by required cache-manager
  operations, not NestJS decorators or module metadata.
- Runtime receives that port and its compiled policy through explicit factory arguments; it does
  not introduce a second dependency-injection container.
- Public key and policy facades remain pure functions. The runtime compiles their primitive input
  into immutable internal Value Objects for namespace, resource name, key version, TTL, and key;
  runtime classes own their collaborators and behavior without becoming public API.
- Class-specific behavior is encapsulated in private members. Independent transformations remain
  in class-free modules, and compiled runtime classes use one file per class.
- A configured call performs key build, cache get, provider call on miss, best-effort set,
  and returns the provider result.
- The runtime cache port is private and has only asynchronous `get(key)` and
  `set(key, value, ttl)` operations. The namespace is an explicit factory dependency.
- Provider method invocation uses `Reflect.apply(method, target, args)` so `this` and
  ECMAScript private fields remain valid.
- Rejected promises and synchronous throws from providers propagate unchanged and are
  never cached.
- `undefined` results are returned but not cached.
- Until iteration 08 introduces the stored-value envelope, cache `null` and `undefined` are
  misses. Provider `null` results are returned but not cached; `false`, `0`, and empty strings
  remain cacheable.
- Cache writes are awaited to preserve operation order; cache get and set failures are fail-open.
- Concurrent misses are independent; request coalescing is post-MVP.
- Properties, symbols, getters, and unconfigured methods follow normal proxy forwarding.

## Functional scope

- Cache hit avoids provider execution.
- Cache miss invokes the provider once and writes an eligible result.
- Unconfigured methods behave as direct provider calls.
- The proxy does not alter consumer call signatures or promise behavior.

## Technical scope

- Runtime policy representation compiled from public policy objects.
- Read rules compile once into an internal method-to-resource map. Mutation-effect rules remain
  passthrough until iteration 07.
- `CachePolicyCompiler`, `CacheAsideExecutor`, and `CacheProxyFactory` compose the runtime;
  compiled rules and the cache port exchange validated Value Objects rather than raw key strings
  or TTL numbers.
- Proxy `get` trap with stable method wrappers where practical.
- Key builder integration and cache-aside execution path.
- Temporary value codec boundary completed by iteration 08; tests must not assume raw
  backend values are the final public contract.

## Expected files and components

- `src/runtime/create-cache-proxy.ts`
- `src/runtime/execute-cache-aside.ts`
- `src/runtime/cache-store.port.ts`
- `src/runtime/compiled-cache-policy.ts`
- `src/runtime/compiled-read-rule.ts`
- `src/runtime/compile-cache-policy.ts`
- internal key namespace, resource, version, key, and TTL Value Objects
- unit fixtures for providers and cache stores

## Detailed steps

1. Define validated internal value objects, the smallest cache operations, and one class per
   runtime policy responsibility.
2. Pass runtime dependencies explicitly through the proxy factory and keep the cache-store port
   private to the runtime boundary.
3. Implement transparent property forwarding and method interception.
4. Compile/cache wrappers without losing target binding.
5. Implement cache hit and miss paths with deterministic keys.
6. Skip writes for `undefined` and failed provider calls.
7. Preserve passthrough behavior for symbols, properties, and unsupported method shapes.
8. Leave cache-error reporting and value envelopes to iteration 08; do not expose either as a
   partial public API.

## Tests

- Unit tests for hit, miss, set, repeated hit, provider rejection, cache get/set failure,
  `undefined`, and falsy values.
- Proxy behavior tests for private fields, getters, setters, symbols, method identity where
  promised, and unconfigured sync/async methods.
- Call-order assertions for cache and provider interactions.

## Acceptance criteria

- A hit returns the cached value without invoking the provider.
- A miss invokes the provider exactly once, attempts one set, and returns the same result.
- Provider failures propagate with no cache write.
- Cache failures do not replace the provider result or error.
- Methods using private fields work through the proxy.
- Passthrough behavior is observationally equivalent for documented cases.
- Runtime remains independent of a Nest application context and receives no NestJS container,
  decorator, or cache-manager type.

## Definition of Done

The global Definition of Done applies. Runtime tests run without bootstrapping NestJS.

## Non-goals

- NestJS providers or dynamic modules
- Mutation effects
- Request coalescing or timeouts
- Observable, stream, or synchronous caching

## Risks and mitigations

- **Risk:** proxy reflection differs from the target. **Mitigation:** test documented
  reflection/property behavior and avoid promises about concrete-class identity.
- **Risk:** `instanceof` expectations conflict with token-oriented DI. **Mitigation:**
  document that consumers depend on the public token, not concrete implementation identity.
- **Risk:** temporary value handling leaks. **Mitigation:** keep encoding behind one seam
  and finalize its contract in iteration 08 before release.

## Dependencies

- Iteration 03

## Documentation updates

Document the cache-aside sequence, passthrough guarantees, supported method contract,
concurrent miss behavior, temporary `null` behavior, and concrete-class identity limitation.

## Exit evidence

- `pnpm run typecheck` and `pnpm run test` pass on Node.js 24.18.0.
- Call-order assertions cover get, provider, set, and repeated hits.
- Private-field, accessor, symbol, stable-wrapper, passthrough, fail-open, and independent
  concurrent-miss fixtures pass without NestJS bootstrapping.
