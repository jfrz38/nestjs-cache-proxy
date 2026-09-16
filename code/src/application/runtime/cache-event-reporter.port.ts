import type { CacheEvent } from './cache-event.js';

export type { CacheEvent } from './cache-event.js';

export interface CacheEventReporter {
  report(event: CacheEvent): void | Promise<void>;
}
