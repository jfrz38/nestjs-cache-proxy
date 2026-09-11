import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Provider } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import { CacheNamespace } from '../key/cache-namespace.js';
import type { CacheStore } from '../runtime/cache-store.port.js';
import { CachePolicyCompiler } from '../runtime/compile-cache-policy.js';
import { CacheProxyFactory } from '../runtime/create-cache-proxy.js';
import { CacheAsideExecutor } from '../runtime/execute-cache-aside.js';
import {
  CACHE_PROXY_OPTIONS,
  type CacheProxyOptions,
} from './cache-proxy-options.js';
import type { CachedProvider } from './cached-provider.types.js';
import { createImplementationToken } from './cache-proxy.tokens.js';
import { validateRegistration } from './validate-registration.js';

const LIFECYCLE_HOOKS = new Set([
  'onModuleInit',
  'onApplicationBootstrap',
  'onModuleDestroy',
  'beforeApplicationShutdown',
  'onApplicationShutdown',
]);

export function cachedProvider<T extends object>(
  registration: CachedProvider<T>,
): Provider[] {
  validateRegistration(registration);

  const implementationToken = createImplementationToken();

  return [
    { provide: implementationToken, useClass: registration.useClass },
    {
      provide: registration.provide,
      useFactory: (
        implementation: T,
        cacheManager: Cache,
        options: CacheProxyOptions,
      ): T =>
        createPublicProxy(
          implementation,
          cacheManager,
          options,
          registration.policy,
        ),
      inject: [implementationToken, CACHE_MANAGER, CACHE_PROXY_OPTIONS],
    },
  ];
}

function createPublicProxy<T extends object>(
  implementation: T,
  cacheManager: Cache,
  options: CacheProxyOptions,
  policy: unknown,
): T {
  const proxy = new CacheProxyFactory(
    new CacheAsideExecutor(
      createCacheStore(cacheManager),
      CacheNamespace.from(options.namespace),
    ),
  ).create(implementation, new CachePolicyCompiler().compile(policy));

  return new Proxy(proxy, {
    get(target, property) {
      if (typeof property === 'string' && LIFECYCLE_HOOKS.has(property)) {
        return undefined;
      }

      return Reflect.get(target, property, target) as unknown;
    },
    set(target, property, value) {
      return Reflect.set(target, property, value, target);
    },
  });
}

function createCacheStore(cacheManager: Cache): CacheStore {
  return {
    get: (key) => cacheManager.get(key.value),
    set: async (key, value, ttl) => {
      await cacheManager.set(key.value, value, ttl.milliseconds);
    },
  };
}
