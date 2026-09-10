# Iteration 01: Project Foundation

## Context and motivation

The repository has architecture documents but no Node package, source tree, tests, or CI.
A reproducible foundation is required before public API work can be reviewed reliably.

## Objective

Create a strict pnpm TypeScript library package in `code/` that builds declarations and
supports repeatable lint, typecheck, test, package, and compatibility workflows.

## Architectural decisions

- pnpm is the only documented package manager.
- Vitest is the test runner.
- TypeScript strict mode is mandatory; public declarations are a release artifact.
- NestJS and cache-manager integration packages are peer dependencies where consumers
  own their runtime instances; development dependencies provide test fixtures.
- Target NestJS majors are 11 and 12. The minimum Node runtime is `20.19`; CI covers the
  applicable latest Node 20, 22, and 24 releases.
- Dependency ranges are based on combinations actually tested, not current registry
  versions alone.
- The root `README.md` and `LICENSE` remain the documentation sources of truth. `prepack`
  copies them temporarily into `code/` so the published tarball includes both files.

## Functional scope

No caching behavior is delivered. Contributors gain one documented command surface for
installation, validation, build, and package inspection.

## Technical scope

- Initialize package metadata, pnpm lockfile, strict TypeScript configuration, and source
  entry point inside `code/`.
- Configure ESM/CommonJS output, source maps, and declarations without duplicate runtime
  dependency bundles.
- Configure Vitest, ESLint, Prettier, and Markdown linting.
- Add CI for install, lint, typecheck, test, build, and package smoke checks.

## Expected files and components

- `code/package.json`, `code/pnpm-lock.yaml`, `code/tsconfig*.json`
- `code/` build, lint, formatting, and Vitest configuration
- `code/src/index.ts`
- `code/tests/`
- `.github/workflows/ci.yml`
- root `Makefile`, `.editorconfig`, `.gitignore`, and package-content allowlist

## Detailed steps

1. Create `feature/project-foundation` from `develop` before changing files.
2. Initialize pnpm metadata, repository fields, engines, and package side effects in `code/`.
3. Use TypeScript 6.0.3 and tsup 8.5.1, which support the Node 20.19 baseline and produce
   dual-format output, declarations, and sourcemaps.
4. Add an explicit pnpm build-script allowlist for `esbuild`; do not enable dependency
   lifecycle scripts globally.
5. Define `lint`, `format:check`, `typecheck`, `test`, `test:coverage`, `build`, and
   `pack:check` scripts.
6. Add strict compiler settings and separate build/type-test configurations as needed.
7. Declare peer and development dependency ranges for the tested NestJS 11 and 12
   combinations.
8. Add a minimal exported placeholder that exercises the package entry points without
   preempting the public policy API planned for iteration 02.
9. Add CI with Node runtime jobs and dependency-compatibility jobs kept distinct.
10. Pack the tarball and import, require, and type-check it from isolated smoke fixtures.
11. Expose all contributor commands through the root Makefile and add weekly Dependabot
    updates for pnpm and GitHub Actions.

## Tests

- Unit: minimal Vitest sanity test and source-map/declaration availability.
- Compile-time: strict compilation with no emit and declaration build.
- Integration: install packed tarball into isolated ESM and CommonJS consumers.
- CI: Node 20, 22, and 24 jobs where supported by the chosen dependency matrix.

## Acceptance criteria

- `pnpm install --frozen-lockfile` is reproducible.
- Every documented quality script succeeds from a clean checkout.
- ESM import, CommonJS require, and TypeScript declarations resolve from the tarball.
- The tarball excludes tests, local configuration, caches, and unpublished sources unless
  intentionally included for source maps.
- Peer ranges do not claim untested NestJS/cache-manager combinations.

## Definition of Done

The global Definition of Done applies, including captured tarball contents and CI results.

## Non-goals

- Public cache policy design
- Runtime proxy behavior
- Redis service setup
- Automated releases or provenance signing

## Risks and mitigations

- **Risk:** TypeScript 7 or a build tool is not yet compatible with the ecosystem.
  **Mitigation:** choose the latest verified compiler, record the range, and upgrade later.
- **Risk:** dual output creates divergent behavior. **Mitigation:** run identical packed
  package smoke tests for both entry points.
- **Risk:** broad peers overstate support. **Mitigation:** separate target compatibility
  from verified combinations and widen ranges only with evidence.

## Dependencies

- Iteration 00

## Documentation updates

Add contributor setup, scripts, supported engines, module formats, and package status to
the README.

## Exit evidence

- CI run URLs or local command transcript
- `pnpm pack --dry-run` file list
- ESM/CommonJS smoke-test results
- Recorded exact toolchain and dependency versions
