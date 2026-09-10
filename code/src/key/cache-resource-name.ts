import { InvalidCacheKeyResourceError } from './cache-key-validation-error.js';

/** Validated resource component of a deterministic cache key. */
export class CacheResourceName {
  private constructor(public readonly value: string) {}

  public static from(value: unknown): CacheResourceName {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidCacheKeyResourceError(
        'Cache key resource must be a non-empty string.',
      );
    }

    return new CacheResourceName(value);
  }
}
