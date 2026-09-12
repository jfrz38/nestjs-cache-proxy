import type { CacheKey } from '../../domain/key/cache-key.js';
import type { TimeToLive } from '../../domain/policy/time-to-live.js';
import { CacheEnvelope, CacheEnvelopeState } from './cache-envelope.js';
import { CacheOperationError } from './cache-error-event.js';
import type { CacheErrorReporter } from './cache-error-reporter.port.js';
import type { CacheStore } from './cache-store.port.js';

export class CacheOperations {
  public constructor(
    private readonly cache: CacheStore,
    private readonly reporter: CacheErrorReporter,
  ) {}

  public async get<Result>(
    resource: string,
    key: CacheKey,
  ): Promise<Result | undefined> {
    try {
      const result = CacheEnvelope.decode(await this.cache.get(key));

      if (result.state === CacheEnvelopeState.HIT) {
        return result.value as Result;
      }

      if (result.state === CacheEnvelopeState.MALFORMED) {
        await this.report(resource, 'get');
      }
    } catch {
      await this.report(resource, 'get');
    }

    return undefined;
  }

  public async set(
    resource: string,
    key: CacheKey,
    value: unknown,
    ttl: TimeToLive,
  ): Promise<void> {
    const envelope = CacheEnvelope.encode(value);

    if (envelope === undefined) {
      return;
    }

    try {
      await this.cache.set(key, envelope, ttl);
    } catch {
      await this.report(resource, 'set');
    }
  }

  public async delete(resource: string, key: CacheKey): Promise<void> {
    try {
      await this.cache.delete(key);
    } catch {
      await this.report(resource, 'delete');
    }
  }

  private async report(
    resource: string,
    operation: 'delete' | 'get' | 'set',
  ): Promise<void> {
    try {
      await this.reporter.report({
        cause: new CacheOperationError(),
        operation,
        resource,
      });
    } catch {
      // Reporting is observational and must not affect provider behavior.
    }
  }
}
