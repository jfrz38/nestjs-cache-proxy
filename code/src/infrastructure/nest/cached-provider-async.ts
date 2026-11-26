import type { Provider } from '@nestjs/common';
import type { CacheResourceMap } from '../../domain/policy/policy.types.js';
import { CachedProviderAsyncFactory } from './cached-provider-async-factory.js';
import type { CachedProviderAsync } from './cached-provider.types.js';

export function cachedProviderAsync<
  T extends object,
  Resources extends Record<string, unknown> = CacheResourceMap<T>,
  FactoryDependencies extends readonly unknown[] = readonly never[],
>(
  registration: CachedProviderAsync<T, Resources, FactoryDependencies>,
): Provider[] {
  return new CachedProviderAsyncFactory().create(registration);
}
