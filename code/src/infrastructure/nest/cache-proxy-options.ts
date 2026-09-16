import type { CacheKeyNamespace } from '../../domain/key/cache-key.types.js';
import type { CacheEventHook } from './cache-event-hook-reporter.js';

export interface CacheProxyOptions {
  readonly namespace: CacheKeyNamespace;
  readonly onCacheEvent?: CacheEventHook;
}

export const CACHE_PROXY_OPTIONS = Symbol('nestjs-cache-proxy.options');
