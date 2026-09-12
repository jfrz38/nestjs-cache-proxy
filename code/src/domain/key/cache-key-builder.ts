import type { BuildCacheKeyInput } from './cache-key.types.js';
import { CacheKey } from './cache-key.js';
import { CacheKeyVersion } from './cache-key-version.js';
import { CacheNamespace } from './cache-namespace.js';
import { CacheResourceName } from './cache-resource-name.js';

export class CacheKeyBuilder {
  public build({
    input,
    namespace,
    resource,
    version,
  }: BuildCacheKeyInput): string {
    return CacheKey.create({
      input,
      namespace: CacheNamespace.from(namespace),
      resource: CacheResourceName.from(resource),
      version: CacheKeyVersion.from(version),
    }).value;
  }
}
