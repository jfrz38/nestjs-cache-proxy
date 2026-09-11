import { InvalidCachePolicyError } from './invalid-cache-policy-error.js';
import { CacheMethodRuleValidator } from './cache-method-rule-validator.js';
import { CacheResourceRegistry } from './cache-resource-registry.js';
import { CacheResourceValidator } from './cache-resource-validator.js';

/** Validates structure available at policy-definition time. */
export class CachePolicyValidator {
  public constructor(
    private readonly resourceValidator: CacheResourceValidator = new CacheResourceValidator(),
    private readonly methodRuleValidator: CacheMethodRuleValidator = new CacheMethodRuleValidator(),
  ) {}

  public validate(policy: unknown): void {
    if (!this.isRecord(policy)) {
      throw this.invalid('Policy must be an object.');
    }

    const { methods, resources } = policy;

    if (!this.isRecord(resources)) {
      throw this.invalid('Policy resources must be an object.');
    }

    if (!this.isRecord(methods)) {
      throw this.invalid('Policy methods must be an object.');
    }

    for (const [name, resource] of Object.entries(resources)) {
      this.resourceValidator.validate(name, resource);
    }

    const resourceRegistry = new CacheResourceRegistry(resources);
    for (const [method, rule] of Object.entries(methods)) {
      this.methodRuleValidator.validate(method, rule, resourceRegistry);
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private invalid(message: string): InvalidCachePolicyError {
    return new InvalidCachePolicyError(message);
  }
}
