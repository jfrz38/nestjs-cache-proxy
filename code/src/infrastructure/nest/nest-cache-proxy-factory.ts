import type { Cache } from 'cache-manager';

import { CacheNamespace } from '../../domain/key/cache-namespace.js';
import { CachePolicyCompiler } from '../../application/runtime/compile-cache-policy.js';
import { CacheProxyFactory } from '../../application/runtime/create-cache-proxy.js';
import { CacheEffectsExecutor } from '../../application/runtime/execute-cache-effects.js';
import { CacheAsideExecutor } from '../../application/runtime/execute-cache-aside.js';
import { MutationExecutor } from '../../application/runtime/execute-mutation.js';
import { CacheOperations } from '../../application/runtime/cache-operations.js';
import { ValidatedCachePolicy } from '../../domain/policy/validated-cache-policy.js';
import type { CacheProxyOptions } from './cache-proxy-options.js';
import { CacheManagerStore } from './cache-manager-store.js';
import { CacheErrorHookReporter } from './cache-error-hook-reporter.js';

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
    const namespace = CacheNamespace.from(options.namespace);
    const cache = new CacheManagerStore(cacheManager);
    const operations = new CacheOperations(
      cache,
      new CacheErrorHookReporter(options.onCacheError),
    );
    const proxy = new CacheProxyFactory(
      new CacheAsideExecutor(operations, namespace),
      new MutationExecutor(new CacheEffectsExecutor(operations, namespace)),
    ).create(
      implementation,
      this.policyCompiler.compile(ValidatedCachePolicy.create(policy)),
    );

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
