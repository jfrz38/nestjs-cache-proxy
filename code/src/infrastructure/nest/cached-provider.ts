import type { Provider } from '@nestjs/common';
import type { CacheResourceMap } from '../../domain/policy/policy.types.js';
import type { CachedProvider } from './cached-provider.types.js';
import { CachedProviderFactory } from './cached-provider-factory.js';

export function cachedProvider<
  T extends object,
  Resources extends Record<string, unknown> = CacheResourceMap<T>,
>(registration: CachedProvider<T, Resources>): Provider[] {
  return new CachedProviderFactory().create(registration);
}
