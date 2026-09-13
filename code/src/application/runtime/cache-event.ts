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

type CacheGetHitEvent = {
  readonly operation: 'get';
  readonly outcome: 'hit';
  readonly resource: string;
  readonly type: CacheEventType.GET_HIT;
};

type CacheGetMissEvent = {
  readonly operation: 'get';
  readonly outcome: 'miss';
  readonly resource: string;
  readonly type: CacheEventType.GET_MISS;
};

type CacheGetErrorEvent = {
  readonly cause: Error;
  readonly operation: 'get';
  readonly outcome: 'error';
  readonly resource: string;
  readonly type: CacheEventType.GET_ERROR;
};

type CacheSetSuccessEvent = {
  readonly operation: 'set';
  readonly outcome: 'success';
  readonly resource: string;
  readonly type: CacheEventType.SET_SUCCESS;
};

type CacheSetSkippedEvent = {
  readonly operation: 'set';
  readonly outcome: 'skipped';
  readonly resource: string;
  readonly type: CacheEventType.SET_SKIPPED;
};

type CacheSetErrorEvent = {
  readonly cause: Error;
  readonly operation: 'set';
  readonly outcome: 'error';
  readonly resource: string;
  readonly type: CacheEventType.SET_ERROR;
};

type CacheDeleteSuccessEvent = {
  readonly operation: 'delete';
  readonly outcome: 'success';
  readonly resource: string;
  readonly type: CacheEventType.DELETE_SUCCESS;
};

type CacheDeleteErrorEvent = {
  readonly cause: Error;
  readonly operation: 'delete';
  readonly outcome: 'error';
  readonly resource: string;
  readonly type: CacheEventType.DELETE_ERROR;
};

export type CacheEvent =
  | CacheGetHitEvent
  | CacheGetMissEvent
  | CacheGetErrorEvent
  | CacheSetSuccessEvent
  | CacheSetSkippedEvent
  | CacheSetErrorEvent
  | CacheDeleteSuccessEvent
  | CacheDeleteErrorEvent;

export class CacheOperationError extends Error {
  public constructor() {
    super(CACHE_OPERATION_ERROR_MESSAGE);
    this.name = CACHE_OPERATION_ERROR_NAME;
  }
}
