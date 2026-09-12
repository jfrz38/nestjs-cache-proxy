export interface CacheErrorEvent {
  readonly cause: unknown;
  readonly operation: 'delete' | 'set';
  readonly resource: string;
}

export interface CacheErrorReporter {
  report(event: CacheErrorEvent): void | Promise<void>;
}
