import type {
  CacheErrorEvent,
  CacheErrorReporter,
} from '../../application/runtime/cache-error-reporter.port.js';

export type CacheErrorHook = (event: CacheErrorEvent) => void | Promise<void>;

export class CacheErrorHookReporter implements CacheErrorReporter {
  public constructor(private readonly hook: CacheErrorHook | undefined) {}

  public report(event: CacheErrorEvent): void | Promise<void> {
    return this.hook?.(event);
  }
}
