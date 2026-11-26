import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Provider } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import type { CacheProxyOptions } from './cache-proxy-options.js';
import { CACHE_PROXY_OPTIONS } from './cache-proxy-options.js';
import type { CachedProviderAsync } from './cached-provider.types.js';
import { CachedProviderRegistrationValidator } from './cached-provider-registration-validator.js';
import { createImplementationToken } from './cache-proxy.tokens.js';
import { NestCacheProxyFactory } from './nest-cache-proxy-factory.js';

export class CachedProviderAsyncFactory {
  public constructor(
    private readonly registrationValidator = new CachedProviderRegistrationValidator(),
    private readonly proxyFactory = new NestCacheProxyFactory(),
  ) {}

  public create<
    T extends object,
    Resources extends Record<string, unknown>,
    FactoryDependencies extends readonly unknown[],
  >(
    registration: CachedProviderAsync<T, Resources, FactoryDependencies>,
  ): Provider[] {
    this.registrationValidator.validateAsync(registration);

    const implementationToken = createImplementationToken();

    return [
      { provide: implementationToken, useClass: registration.useClass },
      {
        provide: registration.provide,
        useFactory: async (
          implementation: T,
          cacheManager: Cache,
          options: CacheProxyOptions,
          ...dependencies: unknown[]
        ): Promise<T> => {
          const policy = await registration.useFactory(
            ...(dependencies as unknown as FactoryDependencies),
          );

          return this.proxyFactory.create(
            implementation,
            cacheManager,
            options,
            policy,
          );
        },
        inject: [
          implementationToken,
          CACHE_MANAGER,
          CACHE_PROXY_OPTIONS,
          ...(registration.inject ?? []),
        ],
      },
    ];
  }
}
