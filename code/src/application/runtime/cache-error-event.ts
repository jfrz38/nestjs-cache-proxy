const CACHE_OPERATION_ERROR_MESSAGE = 'A cache operation failed.';
const CACHE_OPERATION_ERROR_NAME = 'CacheOperationError';

export interface CacheErrorEvent {
  readonly cause: Error;
  readonly operation: 'delete' | 'get' | 'set';
  readonly resource: string;
}

export class CacheOperationError extends Error {
  public constructor() {
    super(CACHE_OPERATION_ERROR_MESSAGE);
    this.name = CACHE_OPERATION_ERROR_NAME;
  }
}
