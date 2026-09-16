const CACHE_OPERATION_ERROR_MESSAGE = 'A cache operation failed.';
const CACHE_OPERATION_ERROR_NAME = 'CacheOperationError';

export enum CacheEventType {
  GET_HIT = 'get.hit',
  GET_MISS = 'get.miss',
  GET_ERROR = 'get.error',
  SET_SUCCESS = 'set.success',
  SET_SKIPPED = 'set.skipped',
  SET_ERROR = 'set.error',
  DELETE_SUCCESS = 'delete.success',
  DELETE_ERROR = 'delete.error',
}

type CacheErrorEventType =
  | CacheEventType.GET_ERROR
  | CacheEventType.SET_ERROR
  | CacheEventType.DELETE_ERROR;

type CacheNonErrorEvent = {
  readonly resource: string;
  readonly type: Exclude<CacheEventType, CacheErrorEventType>;
};

type CacheErrorEvent = {
  readonly cause: Error;
  readonly resource: string;
  readonly type: CacheErrorEventType;
};

export type CacheEvent = CacheNonErrorEvent | CacheErrorEvent;

export class CacheOperationError extends Error {
  public constructor() {
    super(CACHE_OPERATION_ERROR_MESSAGE);
    this.name = CACHE_OPERATION_ERROR_NAME;
  }
}
