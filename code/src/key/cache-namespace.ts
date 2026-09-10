import type { CacheKeyNamespace } from './cache-key.types.js';
import { InvalidCacheKeyNamespaceError } from './cache-key-validation-error.js';

/** Validated application and environment components of a cache-key namespace. */
export class CacheNamespace {
  private constructor(
    public readonly application: string,
    public readonly environment: string,
  ) {}

  public static from(input: CacheKeyNamespace): CacheNamespace {
    if (input === null || typeof input !== 'object') {
      throw new InvalidCacheKeyNamespaceError(
        'Cache key namespace must be an object.',
      );
    }

    validateComponent(input.application, 'application');
    validateComponent(input.environment, 'environment');

    return new CacheNamespace(input.application, input.environment);
  }
}

function validateComponent(
  value: unknown,
  name: string,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidCacheKeyNamespaceError(
      `Cache key ${name} must be a non-empty string.`,
    );
  }
}
