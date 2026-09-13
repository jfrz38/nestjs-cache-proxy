import type { CacheEventReporter } from './cache-event-reporter.port.js';

export class NoopCacheEventReporter implements CacheEventReporter {
  public report(): void {}
}
