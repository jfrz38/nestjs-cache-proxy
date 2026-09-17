# Examples

These recipes show common ways to compose `@jfrz38/nestjs-cache-proxy` in a NestJS
application. They are small, compilable references rather than standalone
applications, and they are not shipped in the npm package.

## Before using a recipe

The examples include `CacheModule.register()` and `CacheProxyModule.forRoot()` so
that each recipe contains its complete composition. In an application, configure
the cache backend and call `forRoot()` once in the application composition root.
Feature modules should normally contain only their cached-provider registration.

All recipes assume Promise-returning singleton providers. Replace the in-memory
implementations, example namespace, TTLs, resource versions, and cache keys with
values appropriate for your application.

## Choose an example

| Recipe                                                 | Demonstrates                                                |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| [cache-in-repository](./cache-in-repository/README.md) | Cache a repository read and invalidate it after a mutation. |
| [cache-in-use-case](./cache-in-use-case/README.md)     | Cache a module-owned use case with `cachedProvider`.        |
| [cross-module-cache](./cross-module-cache/README.md)   | Export a cached provider for a consumer module.             |
| [redis-backend](./redis-backend/README.md)             | Configure Redis as the application cache backend.           |

The boundary is an application decision. A repository cache can share entries
across several operations; a use-case cache can represent the complete result of
one operation. The cross-module example focuses on ownership and NestJS exports,
while the Redis example changes only the application-owned cache backend.

## Registration styles

Use `CacheProxyModule.forFeature()` when the dynamic module can construct the
cached class from dependencies visible in that module. Use `cachedProvider()`
directly in a feature module when the implementation depends on providers owned
or imported by that feature module.

Each recipe is compiled against the packed npm artifact during `pack:check`. This
keeps the examples limited to public package exports and catches documentation
drift before release.
