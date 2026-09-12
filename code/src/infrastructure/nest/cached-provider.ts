import type { Provider } from '@nestjs/common';
import type { CachedProvider } from './cached-provider.types.js';
import { CachedProviderFactory } from './cached-provider-factory.js';

export function cachedProvider<T extends object>(
  registration: CachedProvider<T>,
): Provider[] {
  return new CachedProviderFactory().create(registration);
}
