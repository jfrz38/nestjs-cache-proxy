import type { CacheKeyNamespace } from '../../domain/key/cache-key.types.js';

export interface CacheProxyOptions {
  readonly namespace: CacheKeyNamespace;
}

export const CACHE_PROXY_OPTIONS = Symbol('nestjs-cache-proxy.options');
