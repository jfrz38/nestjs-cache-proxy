const INVALID_CACHE_POLICY_ERROR_NAME = 'InvalidCachePolicyError';

export class InvalidCachePolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = INVALID_CACHE_POLICY_ERROR_NAME;
  }
}
