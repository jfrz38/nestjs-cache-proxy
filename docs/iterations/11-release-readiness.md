# Iteration 11: Release Readiness

**Status:** Complete

## Context and motivation

Passing source tests is insufficient for a library release. Consumers install a tarball,
resolve exports and peers, read declarations, and rely on documentation to avoid unsafe
keys and overstated consistency.

## Objective

Produce a releasable MVP artifact with reviewed public API, complete usage/limitation
documentation, compatibility evidence, and repeatable pre-release checks.

## Architectural decisions

- SemVer applies to runtime behavior, public types, package exports, key format, envelope
  compatibility, and documented defaults.
- The README quick start uses only shipped APIs and application-owned cache configuration.
- Public exports are allowlisted. Internal tokens, compiled policies, envelopes, and cache
  operation wrappers remain private.
- The package is not described as strongly consistent, transaction-aware, or universally
  Redis-compatible.
- Changelog entries identify behavior changes that require resource version bumps.
- Release automation is optional for the MVP; release verification is mandatory.

## Functional scope

- Installation and quick start for a simple inline policy.
- Reference examples for centralized module composition, exact invalidation, write-through,
  testing, memory, and official Redis setup.
- Explicit limitations and compatibility tables.
- Installable package with stable root and testing entry points.

## Technical scope

- Audit package metadata, exports, declarations, source maps, side effects, and files.
- Run packed-package ESM/CommonJS/type smoke fixtures using peer installations.
- Run all quality and compatibility jobs from a clean checkout.
- Establish changelog, versioning guidance, contribution basics, and security reporting.

## Expected files and components

- expanded `README.md`
- `CHANGELOG.md`, `CONTRIBUTING.md`, and security/contact documentation as appropriate
- README compatibility and testing guidance, plus maintained architecture documentation
- isolated package consumer fixtures
- release checklist/script that does not publish

## Detailed steps

1. Audit every root and testing export against the intended public API.
2. Inspect generated declarations for accidental internals and unusable inferred types.
3. Inspect tarball contents and package metadata.
4. Install the tarball in isolated NestJS 11 and 12 consumer fixtures.
5. Compile and execute ESM and CommonJS examples.
6. Review documentation against acceptance tests and remove aspirational API examples.
7. Publish limitations for methods, scope, tokens, invalidation, races, transactions,
   timeouts, serialization, and backend support.
8. Add changelog and release checklist with version/key migration guidance.
9. Run the complete CI-equivalent command set from a clean checkout.

## Tests

- Full lint, format, Markdown, type, unit, integration, and compatibility suites.
- Tarball import/require and declaration compilation in isolated consumers.
- README snippets compiled or exercised where practical.
- Export-map tests ensuring internal paths are inaccessible.
- License, package-content, dependency, and known-secret checks.

## Acceptance criteria

- A new consumer can follow the quick start without modifying provider or consumer code.
- All examples compile against the packed artifact and contain no private imports.
- The package includes only intended files and both entry points resolve correctly.
- Compatibility claims match iteration 10 evidence.
- Limitations explicitly cover exact-only invalidation, singleton/Promise-only support,
  races, transactions, no timeout, and serialization boundaries.
- All release checks pass from a clean checkout.

## Definition of Done

The global Definition of Done applies. The final evidence bundle is reviewed before any
registry publication or release tag.

## Non-goals

- Publishing to npm, creating a GitHub release, or signing provenance unless separately
  requested
- Guaranteeing API stability for roadmap features
- Performance certification
- Automated migration of keys or cached values

## Risks and mitigations

- **Risk:** README examples drift. **Mitigation:** compile examples in CI or source them
  from tested fixtures.
- **Risk:** declaration output exposes internals. **Mitigation:** use explicit exports and
  packed-consumer type tests.
- **Risk:** marketing overstates consistency. **Mitigation:** make limitations part of
  acceptance review and link the roadmap without presenting it as shipped functionality.

## Dependencies

- Iterations 00 through 10

## Documentation updates

Finalize installation, quick start, API reference, compatibility, testing, limitations,
troubleshooting, changelog, versioning, and contribution documentation.

## Exit evidence

- `make release-check` executes formatting, linting, types, tests, coverage, build, packed
  artifact checks, and memory/Redis contracts without publication.
- The tarball manifest allows only `dist`, `README.md`, `LICENSE`, and `package.json`, with a
  one-megabyte size limit and an extracted-content secret scan.
- Isolated ESM/CommonJS consumers load both public entry points, a NestJS TypeScript consumer
  fixture compiles, and an internal export path is rejected.
- The package metadata and declarations are audited for the 0.1.0 public allowlist.
