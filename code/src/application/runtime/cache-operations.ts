import type { CacheKey } from '../../domain/key/cache-key.js';
import type { TimeToLive } from '../../domain/policy/time-to-live.js';
import { CacheEnvelope, CacheEnvelopeState } from './cache-envelope.js';
import { CacheEventType, CacheOperationError } from './cache-event.js';
import type {
  CacheEvent,
  CacheEventReporter,
} from './cache-event-reporter.port.js';
import type { CacheStore } from './cache-store.port.js';

export class CacheOperations {
  public constructor(
    private readonly cache: CacheStore,
    private readonly reporter: CacheEventReporter,
  ) {}

  public async get<Result>(
    resource: string,
    key: CacheKey,
  ): Promise<Result | undefined> {
    try {
      const result = CacheEnvelope.decode(await this.cache.get(key));

      if (result.state === CacheEnvelopeState.HIT) {
        await this.report({
          resource,
          type: CacheEventType.GET_HIT,
        });
        return result.value as Result;
      }

      if (result.state === CacheEnvelopeState.MALFORMED) {
        await this.reportError(resource, CacheEventType.GET_ERROR);
      } else {
        await this.report({
          resource,
          type: CacheEventType.GET_MISS,
        });
      }
    } catch {
      await this.reportError(resource, CacheEventType.GET_ERROR);
    }

    return undefined;
  }

  public async set(
    resource: string,
    key: CacheKey,
    value: unknown,
    ttl: TimeToLive,
    shouldStore: () => boolean = () => true,
  ): Promise<void> {
    try {
      if (shouldStore() !== true) {
        await this.report({
          resource,
          type: CacheEventType.SET_SKIPPED,
        });
        return;
      }

      const envelope = CacheEnvelope.encode(value);
      if (envelope === undefined) {
        await this.report({
          resource,
          type: CacheEventType.SET_SKIPPED,
        });
        return;
      }

      await this.cache.set(key, envelope, ttl);
      await this.report({
        resource,
        type: CacheEventType.SET_SUCCESS,
      });
    } catch {
      await this.reportError(resource, CacheEventType.SET_ERROR);
    }
  }

  public async delete(resource: string, key: CacheKey): Promise<void> {
    try {
      await this.cache.delete(key);
      await this.report({
        resource,
        type: CacheEventType.DELETE_SUCCESS,
      });
    } catch {
      await this.reportError(resource, CacheEventType.DELETE_ERROR);
    }
  }

  private async reportError(
    resource: string,
    type:
      | CacheEventType.DELETE_ERROR
      | CacheEventType.GET_ERROR
      | CacheEventType.SET_ERROR,
  ): Promise<void> {
    await this.report({ cause: new CacheOperationError(), resource, type });
  }

  private async report(event: CacheEvent): Promise<void> {
    try {
      await this.reporter.report(event);
    } catch {
      // Reporting is observational and must not affect provider behavior.
    }
  }
}
