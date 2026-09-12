import { InvalidCacheKeyVersionError } from './cache-key-validation-error.js';

export class CacheKeyVersion {
  private constructor(public readonly value: number) {}

  public static from(value: unknown): CacheKeyVersion {
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value <= 0
    ) {
      throw new InvalidCacheKeyVersionError(
        'Cache key version must be a positive safe integer.',
      );
    }

    return new CacheKeyVersion(value);
  }
}
