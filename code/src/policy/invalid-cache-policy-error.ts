export class InvalidCachePolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidCachePolicyError';
  }
}
