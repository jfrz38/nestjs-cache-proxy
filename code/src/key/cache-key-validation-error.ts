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
    this.name = 'CacheKeyValidationError';
  }
}

export class InvalidCacheKeyNamespaceError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_NAMESPACE', message);
    this.name = 'InvalidCacheKeyNamespaceError';
  }
}

export class InvalidCacheKeyResourceError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_RESOURCE', message);
    this.name = 'InvalidCacheKeyResourceError';
  }
}

export class InvalidCacheKeyVersionError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_VERSION', message);
    this.name = 'InvalidCacheKeyVersionError';
  }
}

export class InvalidCacheKeyInputError extends CacheKeyValidationError {
  public constructor(message: string) {
    super('INVALID_INPUT', message);
    this.name = 'InvalidCacheKeyInputError';
  }
}
