import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Provider } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import type { CacheProxyOptions } from './cache-proxy-options.js';
import { CACHE_PROXY_OPTIONS } from './cache-proxy-options.js';
import type { CachedProvider } from './cached-provider.types.js';
import { CachedProviderRegistrationValidator } from './cached-provider-registration-validator.js';
import { createImplementationToken } from './cache-proxy.tokens.js';
import { NestCacheProxyFactory } from './nest-cache-proxy-factory.js';

export class CachedProviderFactory {
  public constructor(
    private readonly registrationValidator = new CachedProviderRegistrationValidator(),
    private readonly proxyFactory = new NestCacheProxyFactory(),
  ) {}

  public create<T extends object>(registration: CachedProvider<T>): Provider[] {
    this.registrationValidator.validate(registration);

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
          this.proxyFactory.create(
            implementation,
            cacheManager,
            options,
            registration.policy,
          ),
        inject: [implementationToken, CACHE_MANAGER, CACHE_PROXY_OPTIONS],
      },
    ];
  }
}
