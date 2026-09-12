import type { CacheKeyNamespace } from '../../domain/key/cache-key.types.js';
import type { CacheErrorHook } from './cache-error-hook-reporter.js';

export interface CacheProxyOptions {
  readonly namespace: CacheKeyNamespace;
  readonly onCacheError?: CacheErrorHook;
}

export const CACHE_PROXY_OPTIONS = Symbol('nestjs-cache-proxy.options');
