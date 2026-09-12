import type { CachePolicy } from './policy.types.js';
import { CachePolicyValidator } from './cache-policy-validator.js';

export class CachePolicyDefiner {
  public constructor(
    private readonly validator: CachePolicyValidator = new CachePolicyValidator(),
  ) {}

  public define<T, Resources extends Record<string, unknown>>(
    policy: CachePolicy<T, Resources>,
  ): CachePolicy<T, Resources> {
    this.validator.validate(policy);

    return policy;
  }
}
