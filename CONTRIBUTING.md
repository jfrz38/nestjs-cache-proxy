# Contributing

## Setup

Use Node.js 20.19.0 or later, pnpm 12.3.4, GNU Make, and Docker for Redis checks.

```sh
make install
make check
```

`make check` is the fast contributor gate: formatting, linting, type checking, unit tests,
build, and tarball smoke checks. Run `make release-check` before proposing release-readiness
changes; it also runs coverage and memory/Redis backend contracts. The Redis contract creates
and removes its own pinned Docker container.

## Pull requests

- Keep public API, exported types, package exports, key formats, and documented behavior aligned.
- Add tests at the smallest boundary that demonstrates the changed behavior.
- Keep README examples limited to exported APIs and update them with behavior changes.
- Run the relevant Make targets and report checks that require Docker or a different runtime.

## Release verification

`make release-check` validates the build, packed artifact, ESM/CommonJS consumers, TypeScript
consumer fixture, and backend contracts. It does not publish to npm, create a tag, or create a
GitHub release.
