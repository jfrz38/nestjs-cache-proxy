import type { DynamicModule } from '@nestjs/common';

import { CacheNamespace } from '../../domain/key/cache-namespace.js';
import { cachedProvider } from './cached-provider.js';
import {
  CACHE_PROXY_OPTIONS,
  type CacheProxyOptions,
} from './cache-proxy-options.js';
import type { CachedProvider, RuntimeToken } from './cached-provider.types.js';
import { InvalidCachedProviderError } from './invalid-cached-provider-error.js';

export class CacheProxyModule {
  public static forRoot(options: CacheProxyOptions): DynamicModule {
    return {
      module: CacheProxyModule,
      global: true,
      providers: [
        {
          provide: CACHE_PROXY_OPTIONS,
          useValue: CacheProxyModule.normalizeOptions(options),
        },
      ],
      exports: [CACHE_PROXY_OPTIONS],
    };
  }

  public static forFeature<T extends object>(
    registrations: readonly CachedProvider<T>[],
  ): DynamicModule {
    CacheProxyModule.assertRegistrations(registrations);
    CacheProxyModule.validateRegistrations(registrations);

    return {
      module: CacheProxyModule,
      providers: registrations.flatMap((registration) =>
        cachedProvider(registration),
      ),
      exports: registrations.map((registration) => registration.provide),
    };
  }

  private static normalizeOptions(
    options: CacheProxyOptions,
  ): CacheProxyOptions {
    if (options === null || typeof options !== 'object') {
      throw new InvalidCachedProviderError(
        'Cache proxy options must be an object.',
      );
    }

    const namespace = CacheNamespace.from(options.namespace);
    const normalizedOptions: CacheProxyOptions = {
      namespace: {
        application: namespace.application,
        environment: namespace.environment,
      },
    };

    if (options.onCacheError !== undefined) {
      return { ...normalizedOptions, onCacheError: options.onCacheError };
    }

    return normalizedOptions;
  }

  private static validateRegistrations<T extends object>(
    registrations: readonly CachedProvider<T>[],
  ): void {
    const tokens = new Set<RuntimeToken<T>>();
    for (const registration of registrations) {
      if (tokens.has(registration.provide)) {
        throw new InvalidCachedProviderError(
          'Cached provider registrations must not contain duplicate public tokens.',
        );
      }
      tokens.add(registration.provide);
    }
  }

  private static assertRegistrations(registrations: unknown): void {
    if (!Array.isArray(registrations)) {
      throw new InvalidCachedProviderError(
        'Cached provider registrations must be an array.',
      );
    }
  }
}
