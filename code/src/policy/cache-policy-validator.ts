import { CacheKeyVersion } from '../key/cache-key-version.js';
import { InvalidCachePolicyError } from './invalid-cache-policy-error.js';
import { TimeToLive } from './time-to-live.js';

/** Validates structure available at policy-definition time. */
export class CachePolicyValidator {
  private static readonly resourceFields = new Set([
    'key',
    'method',
    'ttl',
    'version',
  ]);
  private static readonly cacheRuleFields = new Set(['cache']);
  private static readonly mutationRuleFields = new Set(['effects']);
  private static readonly invalidateFields = new Set(['invalidate']);
  private static readonly writeThroughFields = new Set(['writeThrough']);
  private static readonly invalidateDefinitionFields = new Set([
    'keyArgs',
    'resource',
  ]);
  private static readonly writeThroughDefinitionFields = new Set([
    'keyArgs',
    'resource',
    'value',
  ]);

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
      this.validateResource(name, resource);
    }

    for (const [method, rule] of Object.entries(methods)) {
      this.validateMethodRule(method, rule, resources);
    }
  }

  private validateResource(name: string, resource: unknown): void {
    if (name.trim().length === 0) {
      throw this.invalid('Resource names must not be empty.');
    }

    if (
      !this.isRecord(resource) ||
      !this.hasOnlyFields(resource, CachePolicyValidator.resourceFields)
    ) {
      throw this.invalid(`Resource "${name}" has an unsupported definition.`);
    }

    if (
      typeof resource.method !== 'string' ||
      resource.method.trim().length === 0
    ) {
      throw this.invalid(`Resource "${name}" must declare a method name.`);
    }

    try {
      TimeToLive.fromMilliseconds(resource.ttl);
    } catch {
      throw this.invalid(
        `Resource "${name}" must declare a positive integer TTL in milliseconds.`,
      );
    }

    try {
      CacheKeyVersion.from(resource.version);
    } catch {
      throw this.invalid(
        `Resource "${name}" must declare a positive integer version.`,
      );
    }

    if (typeof resource.key !== 'function') {
      throw this.invalid(`Resource "${name}" must declare a key builder.`);
    }
  }

  private validateMethodRule(
    method: string,
    rule: unknown,
    resources: Record<string, unknown>,
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
        !this.hasOnlyFields(rule, CachePolicyValidator.cacheRuleFields) ||
        !this.isKnownResource(rule.cache, resources)
      ) {
        throw this.invalid(
          `Method "${method}" references an unknown or invalid resource.`,
        );
      }

      return;
    }

    if (
      !this.hasOnlyFields(rule, CachePolicyValidator.mutationRuleFields) ||
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
      this.validateEffect(method, effect, resources);
    }
  }

  private validateEffect(
    method: string,
    effect: unknown,
    resources: Record<string, unknown>,
  ): void {
    if (!this.isRecord(effect)) {
      throw this.invalid(`Method "${method}" has an invalid cache effect.`);
    }

    const hasInvalidate = Object.hasOwn(effect, 'invalidate');
    const hasWriteThrough = Object.hasOwn(effect, 'writeThrough');

    if (hasInvalidate === hasWriteThrough) {
      throw this.invalid(
        `Method "${method}" effects must declare invalidate or writeThrough.`,
      );
    }

    const definition = hasInvalidate ? effect.invalidate : effect.writeThrough;
    const fields = hasInvalidate
      ? CachePolicyValidator.invalidateFields
      : CachePolicyValidator.writeThroughFields;
    const definitionFields = hasInvalidate
      ? CachePolicyValidator.invalidateDefinitionFields
      : CachePolicyValidator.writeThroughDefinitionFields;

    if (
      !this.hasOnlyFields(effect, fields) ||
      !this.isRecord(definition) ||
      !this.hasOnlyFields(definition, definitionFields) ||
      !this.isKnownResource(definition.resource, resources) ||
      typeof definition.keyArgs !== 'function' ||
      (hasWriteThrough && typeof definition.value !== 'function')
    ) {
      throw this.invalid(`Method "${method}" has an invalid cache effect.`);
    }
  }

  private isKnownResource(
    value: unknown,
    resources: Record<string, unknown>,
  ): value is string {
    return typeof value === 'string' && Object.hasOwn(resources, value);
  }

  private hasOnlyFields(
    value: Record<string, unknown>,
    allowed: ReadonlySet<string>,
  ): boolean {
    return Object.keys(value).every((field) => allowed.has(field));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private invalid(message: string): InvalidCachePolicyError {
    return new InvalidCachePolicyError(message);
  }
}
