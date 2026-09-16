import type { BuildCacheKeyInput } from './cache-key.types.js';
import { CacheKeyBuilder } from './cache-key-builder.js';

export function buildCacheKey({
  input,
  namespace,
  resource,
  version,
}: BuildCacheKeyInput): string {
  return new CacheKeyBuilder().build({ input, namespace, resource, version });
}
