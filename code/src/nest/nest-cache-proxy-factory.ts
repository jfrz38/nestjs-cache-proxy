import type { Cache } from 'cache-manager';

import { CacheNamespace } from '../key/cache-namespace.js';
import { CachePolicyCompiler } from '../runtime/compile-cache-policy.js';
import { CacheProxyFactory } from '../runtime/create-cache-proxy.js';
import { CacheAsideExecutor } from '../runtime/execute-cache-aside.js';
import type { CacheProxyOptions } from './cache-proxy-options.js';
import { CacheManagerStore } from './cache-manager-store.js';

export class NestCacheProxyFactory {
  private static readonly lifecycleHooks = new Set([
    'onModuleInit',
    'onApplicationBootstrap',
    'onModuleDestroy',
    'beforeApplicationShutdown',
    'onApplicationShutdown',
  ]);

  public constructor(
    private readonly policyCompiler: CachePolicyCompiler = new CachePolicyCompiler(),
  ) {}

  public create<T extends object>(
    implementation: T,
    cacheManager: Cache,
    options: CacheProxyOptions,
    policy: unknown,
  ): T {
    const proxy = new CacheProxyFactory(
      new CacheAsideExecutor(
        new CacheManagerStore(cacheManager),
        CacheNamespace.from(options.namespace),
      ),
    ).create(implementation, this.policyCompiler.compile(policy));

    return new Proxy(proxy, {
      get(target, property) {
        if (
          typeof property === 'string' &&
          NestCacheProxyFactory.lifecycleHooks.has(property)
        ) {
          return undefined;
        }

        return Reflect.get(target, property, target) as unknown;
      },
      set(target, property, value) {
        return Reflect.set(target, property, value, target);
      },
    });
  }
}
