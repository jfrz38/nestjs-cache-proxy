import type {
  CacheEvent,
  CacheEventReporter,
} from '../../application/runtime/cache-event-reporter.port.js';

export type CacheEventHook = (event: CacheEvent) => void | Promise<void>;

export class CacheEventHookReporter implements CacheEventReporter {
  public constructor(private readonly hook: CacheEventHook | undefined) {}

  public report(event: CacheEvent): void | Promise<void> {
    return this.hook?.(event);
  }
}
