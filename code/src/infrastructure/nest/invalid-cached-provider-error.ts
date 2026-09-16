const INVALID_CACHED_PROVIDER_ERROR_NAME = 'InvalidCachedProviderError';

export class InvalidCachedProviderError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = INVALID_CACHED_PROVIDER_ERROR_NAME;
  }
}
