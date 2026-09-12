import type { CacheErrorReporter } from './cache-error-reporter.port.js';

export class NoopCacheErrorReporter implements CacheErrorReporter {
  public report(): void {
    // The public error hook is intentionally deferred to the resilience iteration.
  }
}
