import type { CachePolicy, CacheResourceMap } from '../policy/policy.types.js';

export type RuntimeToken<T> =
  (abstract new (...args: never[]) => T) | string | symbol;

export type UseClass<T> = abstract new (...args: never[]) => T;

/**
 * Registration data consumed by the NestJS integration in iteration 05.
 */
export interface CachedProvider<T> {
  readonly provide: RuntimeToken<T>;
  readonly useClass: UseClass<T>;
  readonly policy: CachePolicy<T, CacheResourceMap<T>>;
}
