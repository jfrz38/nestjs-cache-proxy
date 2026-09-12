export interface CacheErrorEvent {
  readonly cause: Error;
  readonly operation: 'delete' | 'get' | 'set';
  readonly resource: string;
}

export class CacheOperationError extends Error {
  public constructor() {
    super('A cache operation failed.');
    this.name = 'CacheOperationError';
  }
}
