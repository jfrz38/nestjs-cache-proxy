import { InvalidCachePolicyError } from './invalid-cache-policy-error.js';
import { CacheEffectValidator } from './cache-effect-validator.js';
import { CacheResourceRegistry } from './cache-resource-registry.js';

export class CacheMethodRuleValidator {
  private static readonly cacheRuleFields = new Set(['cache']);
  private static readonly mutationRuleFields = new Set(['effects']);

  public constructor(
    private readonly effectValidator: CacheEffectValidator = new CacheEffectValidator(),
  ) {}

  public validate(
    method: string,
    rule: unknown,
    resources: CacheResourceRegistry,
  ): void {
    if (method.trim().length === 0) {
      throw this.invalid('Method names must not be empty.');
    }

    if (!this.isRecord(rule)) {
      throw this.invalid(`Method "${method}" must declare one rule.`);
    }

    const hasCache = Object.hasOwn(rule, 'cache');
    const hasEffects = Object.hasOwn(rule, 'effects');

    if (hasCache === hasEffects) {
      throw this.invalid(
        `Method "${method}" must declare either cache or effects.`,
      );
    }

    if (hasCache) {
      if (
        !this.hasOnlyFields(rule, CacheMethodRuleValidator.cacheRuleFields) ||
        !resources.has(rule.cache)
      ) {
        throw this.invalid(
          `Method "${method}" references an unknown or invalid resource.`,
        );
      }

      return;
    }

    if (
      !this.hasOnlyFields(rule, CacheMethodRuleValidator.mutationRuleFields) ||
      !Array.isArray(rule.effects)
    ) {
      throw this.invalid(`Method "${method}" must declare an effects array.`);
    }

    if (rule.effects.length === 0) {
      throw this.invalid(
        `Method "${method}" must declare at least one effect.`,
      );
    }

    for (const effect of rule.effects) {
      this.effectValidator.validate(method, effect, resources);
    }
  }

  private hasOnlyFields(
    value: Record<string, unknown>,
    fields: ReadonlySet<string>,
  ): boolean {
    return Object.keys(value).every((field) => fields.has(field));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private invalid(message: string): InvalidCachePolicyError {
    return new InvalidCachePolicyError(message);
  }
}
