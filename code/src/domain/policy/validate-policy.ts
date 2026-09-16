import { CachePolicyValidator } from './cache-policy-validator.js';

/**
 * Validates only structure available at policy-definition time. Provider method shapes are
 * erased at runtime and are instead constrained by TypeScript and later registration.
 */
export function validateCachePolicy(policy: unknown): void {
  new CachePolicyValidator().validate(policy);
}
