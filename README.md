# nestjs-cache-proxy

Transparent, declarative caching for NestJS providers using DI, proxies, and cache-manager.

The typed cache-policy API is available. Runtime caching and NestJS provider integration are
implemented in later iterations.

## Typed Policies

Policies are plain, inline objects. A resource declares the Promise-returning method that
defines its key arguments and cached result contract:

```ts
const userCachePolicy = defineCachePolicy<UserRepository>()({
  resources: {
    userById: {
      method: 'findById',
      version: 1,
      ttl: 300_000,
      key: ([id]) => id,
    },
  },
  methods: {
    findById: { cache: 'userById' },
  },
});
```

Only Promise-returning methods may be configured. Read rules use `cache`; mutations use a
non-empty ordered `effects` list with exact `invalidate` or `writeThrough` effects. Keys use
`StructuredKeyInput`: JSON-like primitives, arrays, and string-keyed objects. Deterministic
key encoding and runtime key-value validation arrive in iteration 03.

## Requirements

- Node.js 20.19.0 or later
- pnpm 12.3.4
- GNU Make

## Development

The publishable package lives in [`code/`](code/). Root-level commands provide the
canonical contributor interface:

```sh
make install
make check
```

Available checks:

- `make format-check`: verifies Prettier formatting for source and Markdown.
- `make lint`: lints TypeScript and Markdown.
- `make typecheck`: performs strict TypeScript validation without emitting files.
- `make test`: runs Vitest tests.
- `make test-coverage`: runs Vitest with V8 coverage reporting.
- `make build`: emits ESM, CommonJS, declarations, and source maps.
- `make pack-check`: verifies the packed tarball from ESM, CommonJS, and TypeScript consumers.

## Compatibility

The package targets Node.js 20, 22, and 24, plus NestJS 11 and 12. The CI matrix
validates the declared NestJS, `@nestjs/cache-manager`, and `cache-manager` peer
combinations through a packed consumer.

## Package layout

`code/package.json` is the package manifest. The root `README.md` and `LICENSE` remain
the documentation sources of truth; packaging copies them temporarily into `code/` so
the npm tarball contains both files without maintaining duplicates.

- [Architecture](docs/architecture.md)
- [Implementation iterations](docs/iterations/README.md)
