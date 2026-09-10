import type { CachePolicy } from './policy.types.js';
import { validateCachePolicy } from './validate-policy.js';

/**
 * Creates an inline cache policy while retaining its literal resource and method names.
 */
export function defineCachePolicy<T>() {
  return <const Resources extends Record<string, unknown>>(
    policy: CachePolicy<T, Resources>,
  ): CachePolicy<T, Resources> => {
    validateCachePolicy(policy);

    return policy;
  };
}
