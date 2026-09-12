import type { CacheErrorEvent } from './cache-error-event.js';

export type { CacheErrorEvent } from './cache-error-event.js';

export interface CacheErrorReporter {
  report(event: CacheErrorEvent): void | Promise<void>;
}
