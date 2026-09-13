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
          operation: 'get',
          outcome: 'hit',
          resource,
          type: CacheEventType.GET_HIT,
        });
        return result.value as Result;
      }

      if (result.state === CacheEnvelopeState.MALFORMED) {
        await this.reportError(resource, 'get');
      } else {
        await this.report({
          operation: 'get',
          outcome: 'miss',
          resource,
          type: CacheEventType.GET_MISS,
        });
      }
    } catch {
      await this.reportError(resource, 'get');
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
          operation: 'set',
          outcome: 'skipped',
          resource,
          type: CacheEventType.SET_SKIPPED,
        });
        return;
      }

      const envelope = CacheEnvelope.encode(value);
      if (envelope === undefined) {
        await this.report({
          operation: 'set',
          outcome: 'skipped',
          resource,
          type: CacheEventType.SET_SKIPPED,
        });
        return;
      }

      await this.cache.set(key, envelope, ttl);
      await this.report({
        operation: 'set',
        outcome: 'success',
        resource,
        type: CacheEventType.SET_SUCCESS,
      });
    } catch {
      await this.reportError(resource, 'set');
    }
  }

  public async delete(resource: string, key: CacheKey): Promise<void> {
    try {
      await this.cache.delete(key);
      await this.report({
        operation: 'delete',
        outcome: 'success',
        resource,
        type: CacheEventType.DELETE_SUCCESS,
      });
    } catch {
      await this.reportError(resource, 'delete');
    }
  }

  private async reportError(
    resource: string,
    operation: 'delete' | 'get' | 'set',
  ): Promise<void> {
    const cause = new CacheOperationError();

    switch (operation) {
      case 'delete':
        await this.report({
          cause,
          operation,
          outcome: 'error',
          resource,
          type: CacheEventType.DELETE_ERROR,
        });
        return;
      case 'get':
        await this.report({
          cause,
          operation,
          outcome: 'error',
          resource,
          type: CacheEventType.GET_ERROR,
        });
        return;
      case 'set':
        await this.report({
          cause,
          operation,
          outcome: 'error',
          resource,
          type: CacheEventType.SET_ERROR,
        });
    }
  }

  private async report(event: CacheEvent): Promise<void> {
    try {
      await this.reporter.report(event);
    } catch {
      // Reporting is observational and must not affect provider behavior.
    }
  }
}
