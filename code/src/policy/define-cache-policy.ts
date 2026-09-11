import type { CachePolicy } from './policy.types.js';
import { CachePolicyDefiner } from './cache-policy-definer.js';

/**
 * Creates an inline cache policy while retaining its literal resource and method names.
 */
export function defineCachePolicy<T>() {
  return <const Resources extends Record<string, unknown>>(
    policy: CachePolicy<T, Resources>,
  ): CachePolicy<T, Resources> => new CachePolicyDefiner().define(policy);
}
