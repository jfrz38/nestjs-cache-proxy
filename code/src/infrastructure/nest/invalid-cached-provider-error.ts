export class InvalidCachedProviderError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidCachedProviderError';
  }
}
