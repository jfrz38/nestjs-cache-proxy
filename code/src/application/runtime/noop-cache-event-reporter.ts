import type { CacheEvent } from './cache-event.js';
import type { CacheEventReporter } from './cache-event-reporter.port.js';

export class NoopCacheEventReporter implements CacheEventReporter {
  public report(event: CacheEvent): void {
    void event;
  }
}
