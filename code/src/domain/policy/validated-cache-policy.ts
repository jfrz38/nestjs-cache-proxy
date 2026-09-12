import { CachePolicyValidator } from './cache-policy-validator.js';

/** A policy whose definition-time structure has been checked. */
export class ValidatedCachePolicy {
  private constructor(public readonly value: unknown) {}

  public static create(
    policy: unknown,
    validator: CachePolicyValidator = new CachePolicyValidator(),
  ): ValidatedCachePolicy {
    validator.validate(policy);

    return new ValidatedCachePolicy(policy);
  }
}
