const CACHE_KEY_VALIDATION_ERROR_NAME = 'CacheKeyValidationError';
const INVALID_CACHE_KEY_NAMESPACE_ERROR_NAME = 'InvalidCacheKeyNamespaceError';
const INVALID_CACHE_KEY_RESOURCE_ERROR_NAME = 'InvalidCacheKeyResourceError';
const INVALID_CACHE_KEY_VERSION_ERROR_NAME = 'InvalidCacheKeyVersionError';
const INVALID_CACHE_KEY_INPUT_ERROR_NAME = 'InvalidCacheKeyInputError';

export type CacheKeyValidationCode =
  | 'INVALID_NAMESPACE'
  | 'INVALID_RESOURCE'
  | 'INVALID_VERSION'
  | 'INVALID_INPUT';

export class CacheKeyValidationError extends Error {
  public constructor(
    public readonly code: CacheKeyValidationCode,
    message: string,
  ) {
    super(message);
    this.name = CACHE_KEY_VALIDATION_ERROR_NAME;
  }
}

export class InvalidCacheKeyNamespaceError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_NAMESPACE', message);
    this.name = INVALID_CACHE_KEY_NAMESPACE_ERROR_NAME;
  }
}

export class InvalidCacheKeyResourceError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_RESOURCE', message);
    this.name = INVALID_CACHE_KEY_RESOURCE_ERROR_NAME;
  }
}

export class InvalidCacheKeyVersionError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_VERSION', message);
    this.name = INVALID_CACHE_KEY_VERSION_ERROR_NAME;
  }
}

export class InvalidCacheKeyInputError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_INPUT', message);
    this.name = INVALID_CACHE_KEY_INPUT_ERROR_NAME;
  }
}
