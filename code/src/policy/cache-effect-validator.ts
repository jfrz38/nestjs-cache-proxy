import { InvalidCachePolicyError } from './invalid-cache-policy-error.js';
import { CacheResourceRegistry } from './cache-resource-registry.js';

export class CacheEffectValidator {
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

  public validate(
    method: string,
    effect: unknown,
    resources: CacheResourceRegistry,
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
      ? CacheEffectValidator.invalidateFields
      : CacheEffectValidator.writeThroughFields;
    const definitionFields = hasInvalidate
      ? CacheEffectValidator.invalidateDefinitionFields
      : CacheEffectValidator.writeThroughDefinitionFields;

    if (
      !this.hasOnlyFields(effect, fields) ||
      !this.isRecord(definition) ||
      !this.hasOnlyFields(definition, definitionFields) ||
      !resources.has(definition.resource) ||
      typeof definition.keyArgs !== 'function' ||
      (hasWriteThrough && typeof definition.value !== 'function')
    ) {
      throw this.invalid(`Method "${method}" has an invalid cache effect.`);
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
