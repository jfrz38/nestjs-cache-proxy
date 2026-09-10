export type CacheKeyValidationCode =
  | 'INVALID_NAMESPACE'
  | 'INVALID_RESOURCE'
  | 'INVALID_VERSION'
  | 'INVALID_INPUT';

/** Raised when a cache key cannot be built without ambiguity. */
export class CacheKeyValidationError extends Error {
  public constructor(
    public readonly code: CacheKeyValidationCode,
    message: string,
  ) {
    super(message);
    this.name = 'CacheKeyValidationError';
  }
}

/** Raised when the cache-key namespace is invalid. */
export class InvalidCacheKeyNamespaceError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_NAMESPACE', message);
    this.name = 'InvalidCacheKeyNamespaceError';
  }
}

/** Raised when the cache-key resource name is invalid. */
export class InvalidCacheKeyResourceError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_RESOURCE', message);
    this.name = 'InvalidCacheKeyResourceError';
  }
}

/** Raised when the cache-key version is invalid. */
export class InvalidCacheKeyVersionError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_VERSION', message);
    this.name = 'InvalidCacheKeyVersionError';
  }
}

/** Raised when structured cache-key input is invalid. */
export class InvalidCacheKeyInputError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_INPUT', message);
    this.name = 'InvalidCacheKeyInputError';
  }
}
