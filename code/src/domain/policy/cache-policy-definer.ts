import type { CachePolicy } from './policy.types.js';
import { ValidatedCachePolicy } from './validated-cache-policy.js';

export class CachePolicyDefiner {
  public define<T, Resources extends Record<string, unknown>>(
    policy: CachePolicy<T, Resources>,
  ): CachePolicy<T, Resources> {
    ValidatedCachePolicy.create(policy);

    return policy;
  }
}
